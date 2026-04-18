import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import UltraLoader from "@/components/myrank/UltraLoader";

interface Question {
  idx: number;
  question: string;
  options: string[];
}

const TEST_DURATION = 90;

const getOrCreateAnonId = () => {
  let id = localStorage.getItem("myrank_anon_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("myrank_anon_id", id);
  }
  return id;
};

const MyRankTest = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const category = params.get("category") || "IQ";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [testId, setTestId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const anonId = getOrCreateAnonId();
    const ref = sessionStorage.getItem("myrank_ref");

    supabase.functions.invoke("myrank-engine", {
      body: {
        action: "start_test",
        category,
        anon_session_id: anonId,
        user_id: user?.id || null,
        referred_by_code: ref,
      },
    }).then(({ data, error }) => {
      if (error || !data?.questions) {
        console.error("Test start failed:", error);
        navigate("/myrank");
        return;
      }
      setQuestions(data.questions);
      setTestId(data.test_id);
      setAnswers(new Array(data.questions.length).fill(-1));
      startTime.current = Date.now();
      setLoading(false);
    });
  }, [category, user, navigate]);

  useEffect(() => {
    if (loading) return;
    const t = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(t as any);
          submitTest(answers);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [loading]);

  const selectAnswer = (optIdx: number) => {
    const next = [...answers];
    next[current] = optIdx;
    setAnswers(next);
    setTimeout(() => {
      if (current < questions.length - 1) setCurrent((c) => c + 1);
      else submitTest(next);
    }, 200);
  };

  const submitTest = async (finalAnswers: number[]) => {
    if (submitting || !testId) return;
    setSubmitting(true);
    const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
    const { data, error } = await supabase.functions.invoke("myrank-engine", {
      body: {
        action: "submit_test",
        test_id: testId,
        answers: finalAnswers,
        time_taken_seconds: Math.min(elapsed, TEST_DURATION),
      },
    });
    if (error || !data) {
      console.error(error);
      setSubmitting(false);
      return;
    }
    sessionStorage.setItem("myrank_result", JSON.stringify({ ...data, test_id: testId }));
    navigate("/myrank/result");
  };

  if (loading) {
    return <UltraLoader category={category} />;
  }

  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  const timeColor = timeLeft <= 15 ? "text-red-500" : timeLeft <= 30 ? "text-orange-500" : "text-primary";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            {current + 1} / {questions.length}
          </div>
          <div className={`text-2xl font-bold tabular-nums ${timeColor}`}>
            {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
        </div>
        <Progress value={progress} className="h-2" />

        {/* Question */}
        <Card className="p-5 space-y-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {category} · Question {current + 1}
          </div>
          <div className="text-lg font-semibold leading-relaxed">{q.question}</div>
        </Card>

        {/* Options */}
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => selectAnswer(i)}
              disabled={submitting}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                answers[current] === i
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 active:scale-[0.98]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  answers[current] === i ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <div className="flex-1 text-sm">{opt}</div>
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={() => current < questions.length - 1 ? setCurrent((c) => c + 1) : submitTest(answers)}
          variant="outline"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : current === questions.length - 1 ? "Submit" : "Skip"}
        </Button>
      </div>
    </div>
  );
};

export default MyRankTest;
