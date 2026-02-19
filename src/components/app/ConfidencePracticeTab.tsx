import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Sparkles, Heart, Shield, ChevronRight,
  Check, X, Clock, ArrowLeft, Play, RotateCcw,
  Timer, Zap, Brain, ChevronDown, Loader2, Download, Target
} from "lucide-react";
import { useConfidencePractice, PracticeQuestion } from "@/hooks/useConfidencePractice";
import { Progress } from "@/components/ui/progress";

// ─── Encouragement messages ───
const encouragements = [
  "You're improving. Keep going! 💪",
  "You're ready for this. Believe in yourself.",
  "Stay calm, you've practiced this before.",
  "Every question makes you stronger.",
  "You're building real confidence.",
  "Great focus! You're on the right path.",
  "Trust your preparation.",
  "One step closer to your goal! 🌟",
];

const examTypes = ["UPSC", "SSC", "Banking", "JEE", "NEET", "State PSC"];
const subjects = ["General Knowledge", "Mathematics", "Reasoning", "English", "Science", "History", "Geography", "Polity", "Economy", "Physics", "Chemistry", "Biology"];
const years = [2024, 2023, 2022, 2021, 2020];
const difficulties = ["easy", "medium", "hard"];

type PracticeMode = "calm" | "exam" | "rapid";
type Section = "menu" | "bank_setup" | "predicted_setup" | "practice" | "result";

const ConfidencePracticeTab = () => {
  const { loading, questions, totalAvailable, stats, fetchBankQuestions, generatePredicted, saveProgress, fetchStats, fetchUserExam, setQuestions, populatingPYQs, pyqProgress, populateQuestionBank } = useConfidencePractice();

  const [pyqResult, setPyqResult] = useState<{ success: boolean; message: string } | null>(null);
  const [pyqProgressPercent, setPyqProgressPercent] = useState(0);

  const [section, setSection] = useState<Section>("menu");
  const [mode, setMode] = useState<PracticeMode>("calm");
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [encourageIdx, setEncourageIdx] = useState(0);
  const [source, setSource] = useState<"bank" | "predicted">("bank");
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [sessionAnswers, setSessionAnswers] = useState<boolean[]>([]);
  const [userExamLoaded, setUserExamLoaded] = useState(false);
  const [userExamType, setUserExamType] = useState("");

  // Filters
  const [selExam, setSelExam] = useState("");
  const [selSubject, setSelSubject] = useState("");
  const [selYear, setSelYear] = useState<number | "">("");
  const [selDifficulty, setSelDifficulty] = useState("");
  const [selCount, setSelCount] = useState(20);

  // Fetch user's exam type from profile on mount
  useEffect(() => {
    fetchUserExam().then(exam => {
      if (exam) {
        const matched = examTypes.find(e => e.toLowerCase() === exam.toLowerCase()) || "";
        if (matched) {
          setSelExam(matched);
          setUserExamType(matched);
        }
      }
      setUserExamLoaded(true);
    });
  }, [fetchUserExam]);

  // Only show the user's onboarded exam type
  const availableExamTypes = userExamType ? [userExamType] : examTypes;

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-start practice when questions load
  useEffect(() => {
    if (questions.length > 0 && (section === "bank_setup" || section === "predicted_setup")) {
      startPractice(source, mode);
    }
  }, [questions]);

  // Exam mode timer
  useEffect(() => {
    if (mode !== "exam" || section !== "practice" || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { handleFinish(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [mode, section, timeLeft]);

  const startPractice = useCallback((src: "bank" | "predicted", practiceMode: PracticeMode) => {
    setSource(src);
    setMode(practiceMode);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setScore({ correct: 0, total: 0 });
    setSessionAnswers([]);
    setQuestionStartTime(Date.now());

    if (practiceMode === "exam") {
      setTimeLeft(questions.length * 60); // 1 min per question
    }
    setSection("practice");
  }, [questions.length]);

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    const q = questions[currentQ];
    const correct = idx === q.correct_answer;
    setScore(p => ({ correct: p.correct + (correct ? 1 : 0), total: p.total + 1 }));
    setSessionAnswers(p => [...p, correct]);

    if (correct) setEncourageIdx(p => (p + 1) % encouragements.length);

    if (mode === "calm") {
      setShowExplanation(true);
    } else {
      // Auto-advance in exam/rapid
      setTimeout(() => nextQuestion(), mode === "rapid" ? 800 : 1500);
    }
  };

  const nextQuestion = () => {
    if (currentQ >= questions.length - 1) {
      handleFinish();
      return;
    }
    setCurrentQ(p => p + 1);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setQuestionStartTime(Date.now());
  };

  const handleFinish = () => {
    setSection("result");
    fetchStats();
  };

  const loadBankQuestions = async () => {
    await fetchBankQuestions({
      exam_type: selExam || undefined,
      subject: selSubject || undefined,
      year: selYear ? Number(selYear) : undefined,
      difficulty: selDifficulty || undefined,
      count: selCount || undefined,
    });
  };

  const loadPredictedQuestions = async () => {
    await generatePredicted({
      exam_type: selExam || undefined,
      subject: selSubject || undefined,
      count: selCount,
    });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ─── MAIN MENU ───
  if (section === "menu") {
    return (
      <div className="px-5 py-6 space-y-5 max-w-lg mx-auto">
        {/* ─── Hero Header (HomeTab style) ─── */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl p-6 text-center"
          style={{
            background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
            border: "1px solid hsl(var(--border))",
          }}
        >
          {/* Decorative glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "hsl(var(--primary))" }} />
          <div className="absolute bottom-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none" style={{ background: "hsl(var(--primary))" }} />

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))",
              border: "1px solid hsl(var(--primary) / 0.3)",
            }}
          >
            <Target className="w-8 h-8 text-primary" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
            style={{
              background: "hsl(var(--primary) / 0.1)",
              border: "1px solid hsl(var(--primary) / 0.2)",
            }}
          >
            <Zap className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Exam Focus Mode</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold text-foreground mb-1"
          >
            Confidence Practice
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs text-muted-foreground max-w-xs mx-auto"
          >
            No pressure. No ranks. Just you and your preparation.
          </motion.p>

          {/* Mini stats row */}
          {stats && stats.total > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-3 gap-2 mt-5"
            >
              <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
                <p className="text-lg font-bold text-foreground tabular-nums">{stats.total}</p>
                <p className="text-[9px] text-muted-foreground">Practiced</p>
              </div>
              <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
                <p className="text-lg font-bold text-primary tabular-nums">{stats.accuracy}%</p>
                <p className="text-[9px] text-muted-foreground">Accuracy</p>
              </div>
              <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
                <p className="text-lg font-bold text-foreground tabular-nums">{stats.correct}</p>
                <p className="text-[9px] text-muted-foreground">Correct</p>
              </div>
            </motion.div>
          )}
        </motion.section>

        {/* ─── Fetch PYQs Card ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <AnimatePresence>
            {pyqResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`mb-3 rounded-2xl p-4 border flex items-start gap-3 ${
                  pyqResult.success
                    ? "bg-success/10 border-success/30"
                    : "bg-destructive/10 border-destructive/30"
                }`}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    pyqResult.success ? "bg-success/20" : "bg-destructive/20"
                  }`}
                >
                  {pyqResult.success ? <Check className="w-4 h-4 text-success" /> : <X className="w-4 h-4 text-destructive" />}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${pyqResult.success ? "text-success" : "text-destructive"}`}>
                    {pyqResult.success ? "PYQs Generated Successfully! 🎉" : "Generation Failed"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{pyqResult.message}</p>
                </div>
                <button onClick={() => setPyqResult(null)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              setPyqResult(null);
              setPyqProgressPercent(0);
              const interval = setInterval(() => {
                setPyqProgressPercent(prev => {
                  if (prev >= 90) { clearInterval(interval); return 90; }
                  return prev + Math.random() * 8 + 2;
                });
              }, 800);
              const result = await populateQuestionBank(selExam || undefined);
              clearInterval(interval);
              setPyqProgressPercent(100);
              setTimeout(() => {
                setPyqProgressPercent(0);
                if (result?.error) {
                  setPyqResult({ success: false, message: result.error });
                } else if (result?.alreadyComplete) {
                  setPyqResult({ success: true, message: result.message || "Question bank is already fully populated!" });
                } else {
                  setPyqResult({ success: true, message: result?.message || `${result?.totalInserted || 0} new questions added.` });
                }
              }, 500);
            }}
            disabled={populatingPYQs}
            className="w-full rounded-2xl p-4 text-left relative overflow-hidden transition-all disabled:opacity-60 group"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
              border: "1px dashed hsl(var(--primary) / 0.3)",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex items-center gap-3">
              {populatingPYQs ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
                >
                  <Loader2 className="w-5 h-5 text-primary" />
                </motion.div>
              ) : (
                <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Download className="w-5 h-5 text-primary" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">
                  {populatingPYQs ? "Generating PYQs..." : "Fetch Last 5 Years PYQs"}
                </p>
                {populatingPYQs ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${Math.min(pyqProgressPercent, 100)}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {pyqProgressPercent < 30 ? "🔄 Initializing AI generation..." :
                       pyqProgressPercent < 60 ? "🧠 Generating questions for subjects..." :
                       pyqProgressPercent < 90 ? "💾 Saving to question bank..." :
                       "✨ Finalizing..."}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    AI generates authentic exam questions for all subjects & years
                  </p>
                )}
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* ─── Section A: Question Bank Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setSource("bank"); setSection("bank_setup"); }}
            className="w-full rounded-3xl p-5 text-left relative overflow-hidden group"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none" style={{ background: "hsl(var(--primary))" }} />
            <motion.div
              className="absolute bottom-2 left-2 w-20 h-20 rounded-full opacity-5 pointer-events-none"
              style={{ background: "hsl(var(--primary))" }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            <div className="relative z-10 flex items-start gap-4">
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))",
                  border: "1px solid hsl(var(--primary) / 0.3)",
                }}
                animate={{ rotate: [0, 3, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <BookOpen className="w-7 h-7 text-primary" />
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-foreground text-base">Last 5 Years Question Bank</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Practice real previous year questions. Actual exam questions for authentic preparation.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {["Year-wise", "Topic-wise", "Real PYQs"].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                      style={{
                        background: "hsl(var(--primary) / 0.1)",
                        color: "hsl(var(--primary))",
                        border: "1px solid hsl(var(--primary) / 0.15)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="shrink-0 mt-2"
              >
                <ChevronRight className="w-5 h-5 text-primary/60 group-hover:text-primary transition-colors" />
              </motion.div>
            </div>
          </motion.button>
        </motion.div>

        {/* ─── Section B: AI Predicted Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setSource("predicted"); setSection("predicted_setup"); }}
            className="w-full rounded-3xl p-5 text-left relative overflow-hidden group"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            {/* Animated glow */}
            <motion.div
              className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
              style={{ background: "hsl(var(--primary))", filter: "blur(60px)" }}
              animate={{ opacity: [0.08, 0.15, 0.08] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div
              className="absolute bottom-0 left-0 w-24 h-24 rounded-full pointer-events-none"
              style={{ background: "hsl(var(--accent))", filter: "blur(40px)" }}
              animate={{ opacity: [0.05, 0.1, 0.05] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1 }}
            />

            <div className="relative z-10 flex items-start gap-4">
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--accent) / 0.1))",
                  border: "1px solid hsl(var(--primary) / 0.35)",
                  boxShadow: "0 0 20px hsl(var(--primary) / 0.15)",
                }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-7 h-7 text-primary" />
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-foreground text-base">AI Predicted Questions</h3>
                  <motion.span
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="px-2 py-0.5 rounded-lg text-[9px] font-extrabold"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--accent) / 0.15))",
                      color: "hsl(var(--primary))",
                      border: "1px solid hsl(var(--primary) / 0.3)",
                    }}
                  >
                    AI ✨
                  </motion.span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  High-probability questions by AI based on 5-year pattern analysis. Focus on what's most likely to appear.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "Very High", glow: true },
                    { label: "High", glow: true },
                    { label: "Medium", glow: false },
                  ].map(({ label, glow }) => (
                    <span
                      key={label}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                      style={{
                        background: glow ? "hsl(var(--primary) / 0.15)" : "hsl(var(--secondary))",
                        color: glow ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                        border: `1px solid ${glow ? "hsl(var(--primary) / 0.2)" : "hsl(var(--border))"}`,
                        ...(glow ? { boxShadow: "0 0 8px hsl(var(--primary) / 0.1)" } : {}),
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="shrink-0 mt-2"
              >
                <ChevronRight className="w-5 h-5 text-primary/60 group-hover:text-primary transition-colors" />
              </motion.div>
            </div>
          </motion.button>
        </motion.div>

        {/* Calming footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-3"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "hsl(var(--primary) / 0.05)", border: "1px solid hsl(var(--primary) / 0.1)" }}>
            <Heart className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-xs text-muted-foreground italic">Take a deep breath. You've got this.</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── SETUP SCREENS ───
  if (section === "bank_setup" || section === "predicted_setup") {
    const isPredicted = section === "predicted_setup";
    return (
      <div className="px-5 py-6 space-y-5 max-w-lg mx-auto">
        <button onClick={() => setSection("menu")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground">{isPredicted ? "AI Predicted Questions" : "Question Bank Setup"}</h2>
          <p className="text-xs text-muted-foreground">{isPredicted ? "AI will generate high-probability questions" : "Select filters to practice real previous year questions"}</p>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Exam Type</label>
            <div className="flex flex-wrap gap-2">
              {availableExamTypes.map(e => (
                <button key={e} onClick={() => setSelExam(selExam === e ? "" : e)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selExam === e ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >{e}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
            <div className="flex flex-wrap gap-2">
              {subjects.map(s => (
                <button key={s} onClick={() => setSelSubject(selSubject === s ? "" : s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selSubject === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >{s}</button>
              ))}
            </div>
          </div>

          {!isPredicted && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Year</label>
                <div className="flex flex-wrap gap-2">
                  {years.map(y => (
                    <button key={y} onClick={() => setSelYear(selYear === y ? "" : y)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selYear === y ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                    >{y}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Difficulty</label>
                <div className="flex flex-wrap gap-2">
                  {difficulties.map(d => (
                    <button key={d} onClick={() => setSelDifficulty(selDifficulty === d ? "" : d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${selDifficulty === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                    >{d}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Questions Count
            </label>
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30, 50].map(n => (
                <button key={n} onClick={() => setSelCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selCount === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Practice Modes */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground block">Practice Mode</label>
          {([
            { id: "calm" as PracticeMode, icon: Heart, title: "Calm Practice", desc: "No timer, no pressure, instant explanations", color: "text-primary" },
            { id: "exam" as PracticeMode, icon: Timer, title: "Exam Simulation", desc: "Real exam timer, no hints, result at end", color: "text-warning" },
            { id: "rapid" as PracticeMode, icon: Zap, title: "Rapid Revision", desc: "Quick solve, high-probability questions", color: "text-primary" },
          ]).map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`w-full rounded-xl p-3.5 text-left flex items-center gap-3 border transition-all ${mode === m.id ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-border/80"}`}
            >
              <m.icon className={`w-5 h-5 ${m.color}`} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{m.title}</p>
                <p className="text-[10px] text-muted-foreground">{m.desc}</p>
              </div>
              {mode === m.id && <Check className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>

        {/* Start Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={async () => {
            if (isPredicted) await loadPredictedQuestions();
            else await loadBankQuestions();
          }}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? (isPredicted ? "AI is generating questions..." : "Loading questions...") : "Start Practice"}
        </motion.button>
      </div>
    );
  }

  // (Hook moved to top level)

  // ─── PRACTICE SESSION ───
  if (section === "practice" && questions.length > 0) {
    const q = questions[currentQ];
    const progress = ((currentQ + (selectedAnswer !== null ? 1 : 0)) / questions.length) * 100;
    const isCorrect = selectedAnswer !== null ? selectedAnswer === q.correct_answer : null;

    return (
      <div className="px-5 py-6 space-y-4 max-w-lg mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setSection("menu"); setQuestions([]); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Exit
          </button>
          <div className="flex items-center gap-3">
            {mode === "exam" && (
              <span className={`text-xs font-mono font-bold ${timeLeft < 60 ? "text-destructive" : "text-muted-foreground"}`}>
                <Timer className="w-3 h-3 inline mr-1" />{formatTime(timeLeft)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{currentQ + 1}/{questions.length}</span>
          </div>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-1.5" />

        {/* Prediction badge for AI predicted questions */}
        {source === "predicted" && q.probability_score && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-3 border border-primary/20 bg-primary/5 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  (q.probability_score || 0) >= 80 ? "bg-primary/20 text-primary" :
                  (q.probability_score || 0) >= 60 ? "bg-accent/20 text-accent-foreground" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  🎯 {q.probability_level || "Predicted"}
                </div>
                <span className="text-xs font-bold text-foreground">{q.probability_score}% match</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Based on 5-year PYQ analysis</span>
            </div>
            {q.trend_reason && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                📊 {q.trend_reason}
              </p>
            )}
          </motion.div>
        )}

        {/* Previous year tag for bank */}
        {source === "bank" && q.previous_year_tag && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
            📋 {q.previous_year_tag}
          </span>
        )}

        {/* Topic & difficulty */}
        <div className="flex items-center gap-2 flex-wrap">
          {q.topic && <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-muted-foreground">{q.topic}</span>}
          {q.difficulty && <span className={`px-2 py-0.5 rounded-full text-[10px] capitalize ${
            q.difficulty === "hard" ? "bg-destructive/15 text-destructive" :
            q.difficulty === "easy" ? "bg-success/15 text-success" :
            "bg-warning/15 text-warning"
          }`}>{q.difficulty}</span>}
        </div>

        {/* Question */}
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl p-5 bg-card border border-border"
        >
          <p className="text-sm font-medium text-foreground leading-relaxed">{q.question}</p>
        </motion.div>

        {/* Options */}
        <div className="space-y-2.5">
          {q.options.map((opt, idx) => {
            const selected = selectedAnswer === idx;
            const isRight = idx === q.correct_answer;
            const showResult = selectedAnswer !== null;

            return (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleAnswer(idx)}
                disabled={selectedAnswer !== null}
                className={`w-full rounded-xl p-4 text-left text-sm transition-all border ${
                  showResult
                    ? isRight
                      ? "border-success/50 bg-success/10"
                      : selected
                        ? "border-destructive/50 bg-destructive/10"
                        : "border-border bg-card opacity-60"
                    : "border-border bg-card hover:border-primary/30 active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    showResult && isRight ? "bg-success/20 text-success" :
                    showResult && selected ? "bg-destructive/20 text-destructive" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {showResult && isRight ? <Check className="w-3.5 h-3.5" /> :
                     showResult && selected ? <X className="w-3.5 h-3.5" /> :
                     String.fromCharCode(65 + idx)}
                  </div>
                  <span className="text-foreground">{opt}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Encouragement on correct answer */}
        <AnimatePresence>
          {selectedAnswer !== null && isCorrect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-2"
            >
              <p className="text-sm text-primary font-medium">{encouragements[encourageIdx]}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explanation (calm mode) */}
        {mode === "calm" && showExplanation && q.explanation && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4 bg-primary/5 border border-primary/10"
          >
            <p className="text-xs font-semibold text-primary mb-1">Explanation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
          </motion.div>
        )}

        {/* Next button (calm mode) */}
        {mode === "calm" && selectedAnswer !== null && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={nextQuestion}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            {currentQ >= questions.length - 1 ? "See Results" : "Next Question"}
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        )}
      </div>
    );
  }

  // ─── RESULTS ───
  if (section === "result") {
    const accuracy = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    const resultMessage = accuracy >= 80 ? "Outstanding! You're exam-ready! 🌟" :
                          accuracy >= 60 ? "Great progress! Keep practicing! 💪" :
                          accuracy >= 40 ? "You're building confidence. Don't stop! 🙏" :
                          "Every practice session makes you stronger. 🌱";

    return (
      <div className="px-5 py-6 space-y-6 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Practice Complete</h2>
          <p className="text-sm text-muted-foreground">{resultMessage}</p>
        </motion.div>

        <div className="rounded-2xl p-6 bg-card border border-border space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-primary">{accuracy}%</p>
            <p className="text-xs text-muted-foreground mt-1">Accuracy</p>
          </div>
          <Progress value={accuracy} className="h-2" />
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{score.total}</p>
              <p className="text-[10px] text-muted-foreground">Attempted</p>
            </div>
            <div>
              <p className="text-lg font-bold text-success">{score.correct}</p>
              <p className="text-[10px] text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-lg font-bold text-destructive">{score.total - score.correct}</p>
              <p className="text-[10px] text-muted-foreground">Incorrect</p>
            </div>
          </div>
        </div>

        {/* Answer summary mini */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {sessionAnswers.map((correct, i) => (
            <div key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
              correct ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
            }`}>{i + 1}</div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => { setSection("menu"); setQuestions([]); }}
            className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </button>
          <button onClick={() => startPractice(source, mode)}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Retry
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground italic flex items-center justify-center gap-1.5">
            <Heart className="w-3 h-3 text-primary/60" />
            Stay calm, you've practiced this. You're ready.
          </p>
        </div>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
};

export default ConfidencePracticeTab;
