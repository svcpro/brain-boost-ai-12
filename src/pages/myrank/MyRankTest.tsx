import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Clock, ChevronLeft, Flag, Sparkles } from "lucide-react";
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
  const [selectedFlash, setSelectedFlash] = useState<number | null>(null);
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
    if (submitting) return;
    setSelectedFlash(optIdx);
    const next = [...answers];
    next[current] = optIdx;
    setAnswers(next);
    if (navigator.vibrate) navigator.vibrate(15);
    setTimeout(() => {
      setSelectedFlash(null);
      if (current < questions.length - 1) setCurrent((c) => c + 1);
      else submitTest(next);
    }, 320);
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

  if (loading) return <UltraLoader category={category} />;

  if (submitting) return <UltraLoader category="Calculating your rank" />;

  if (!questions.length) return <UltraLoader category={category} />;

  const safeIdx = Math.min(Math.max(current, 0), questions.length - 1);
  const q = questions[safeIdx];
  if (!q) return <UltraLoader category={category} />;
  const progress = ((safeIdx + 1) / questions.length) * 100;
  const timePct = (timeLeft / TEST_DURATION) * 100;
  const lowTime = timeLeft <= 15;
  const midTime = timeLeft <= 30 && timeLeft > 15;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white">
      {/* Aurora bg */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.15),transparent_60%)]" />
        <div
          className={`absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl transition-colors duration-700 ${
            lowTime ? "bg-red-600/30" : midTime ? "bg-amber-500/25" : "bg-fuchsia-600/25"
          } animate-pulse`}
          style={{ animationDuration: lowTime ? "1.2s" : "5s" }}
        />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" style={{ animationDuration: "7s" }} />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {lowTime && (
          <div className="absolute inset-0 ring-4 ring-inset ring-red-500/30 animate-pulse pointer-events-none" />
        )}
      </div>

      <div className="relative z-10 max-w-md mx-auto px-4 pt-4 pb-8 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate("/myrank")}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Exit
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3 text-fuchsia-400" />
            <span className="bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              {category}
            </span>
          </div>
          <div className="text-xs font-bold text-white/70 tabular-nums">
            {current + 1}<span className="text-white/30">/{questions.length}</span>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 mb-5">
          {questions.map((_, i) => {
            const answered = answers[i] !== -1;
            const isCurrent = i === current;
            return (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-all duration-500"
                style={{
                  background: isCurrent
                    ? "linear-gradient(90deg, #ec4899, #06b6d4)"
                    : answered
                    ? "linear-gradient(90deg, #10b981, #06b6d4)"
                    : "rgba(255,255,255,0.08)",
                  boxShadow: isCurrent ? "0 0 10px rgba(236,72,153,0.7)" : answered ? "0 0 6px rgba(16,185,129,0.5)" : "none",
                }}
              />
            );
          })}
        </div>

        {/* Timer ring */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
              <circle
                cx="60" cy="60" r="54" fill="none" strokeWidth="6" strokeLinecap="round"
                stroke={lowTime ? "#ef4444" : midTime ? "#f59e0b" : "url(#timerGrad)"}
                strokeDasharray={2 * Math.PI * 54}
                strokeDashoffset={2 * Math.PI * 54 * (1 - timePct / 100)}
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }}
              />
              <defs>
                <linearGradient id="timerGrad" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Clock className={`w-3.5 h-3.5 mb-0.5 ${lowTime ? "text-red-400 animate-pulse" : midTime ? "text-amber-400" : "text-white/40"}`} />
              <div
                className={`text-3xl font-extrabold tabular-nums ${
                  lowTime ? "text-red-400 animate-pulse" : midTime ? "text-amber-300" : "text-white"
                }`}
                style={{ textShadow: lowTime ? "0 0 20px rgba(239,68,68,0.7)" : "0 0 12px rgba(236,72,153,0.4)" }}
              >
                {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-white/40 mt-0.5">
                {lowTime ? "Hurry!" : midTime ? "Focus" : "Time left"}
              </div>
            </div>
          </div>
        </div>

        {/* Question card */}
        <div
          key={current}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl p-5 mb-4 animate-[fade-in_0.4s_ease-out]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.12),transparent_60%)] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="px-2 py-0.5 rounded-md bg-fuchsia-500/15 border border-fuchsia-400/30 text-[10px] font-bold tracking-wider text-fuchsia-300">
                Q{current + 1}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                {progress.toFixed(0)}% complete
              </div>
            </div>
            <div className="text-base font-semibold leading-relaxed text-white">
              {q.question}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2.5 flex-1">
          {q.options.map((opt, i) => {
            const isSelected = answers[current] === i;
            const isFlashing = selectedFlash === i;
            return (
              <button
                key={`${current}-${i}`}
                onClick={() => selectAnswer(i)}
                disabled={submitting}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`group relative w-full overflow-hidden p-3.5 rounded-2xl text-left transition-all duration-300 animate-[fade-in_0.4s_ease-out_both] active:scale-[0.98] ${
                  isFlashing
                    ? "border-2 border-fuchsia-400 bg-gradient-to-r from-fuchsia-500/30 to-cyan-500/30 shadow-[0_0_30px_-5px_rgba(236,72,153,0.7)]"
                    : isSelected
                    ? "border-2 border-fuchsia-400/80 bg-fuchsia-500/15"
                    : "border border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                }`}
              >
                {/* Sheen on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                <div className="relative flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold transition-all duration-300 ${
                      isFlashing || isSelected
                        ? "bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.6)] scale-110"
                        : "bg-white/[0.06] border border-white/10 text-white/70 group-hover:bg-white/10"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div className="flex-1 text-sm font-medium text-white/90">{opt}</div>
                  {(isFlashing || isSelected) && (
                    <div className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.9)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom action */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => current > 0 && setCurrent((c) => c - 1)}
            disabled={current === 0}
            className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/60 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => (current < questions.length - 1 ? setCurrent((c) => c + 1) : submitTest(answers))}
            disabled={submitting}
            className="flex-1 group relative overflow-hidden px-4 py-3 rounded-xl font-bold text-sm text-white border border-white/10 bg-gradient-to-r from-fuchsia-500/20 via-pink-500/20 to-cyan-500/20 hover:from-fuchsia-500/40 hover:to-cyan-500/40 transition-all"
          >
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="relative flex items-center justify-center gap-2">
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : current === questions.length - 1 ? (
                <>
                  <Flag className="w-4 h-4" />
                  Submit & Reveal Rank
                </>
              ) : (
                <>Skip →</>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyRankTest;
