import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Sparkles, Heart, Shield, ChevronRight,
  Check, X, Clock, ArrowLeft, Play, RotateCcw,
  Timer, Zap, Brain, ChevronDown, Loader2, Download, Target,
  BarChart3, TrendingUp, TrendingDown, Eye, Info, Activity, Minus, AlertTriangle
} from "lucide-react";
import { useConfidencePractice, PracticeQuestion } from "@/hooks/useConfidencePractice";
import { Progress } from "@/components/ui/progress";
import MentorSuggestion from "./MentorSuggestion";
import ReactMarkdown from "react-markdown";

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

const examSubjectsMap: Record<string, string[]> = {
  "UPSC": ["General Knowledge", "History", "Geography", "Polity", "Economy", "Science", "English", "Mathematics", "Reasoning"],
  "SSC": ["General Knowledge", "Mathematics", "Reasoning", "English"],
  "Banking": ["General Knowledge", "Mathematics", "Reasoning", "English"],
  "JEE": ["Physics", "Chemistry", "Mathematics"],
  "NEET": ["Physics", "Chemistry", "Biology"],
  "State PSC": ["General Knowledge", "History", "Geography", "Polity", "Economy", "Science", "English", "Mathematics", "Reasoning"],
};

const allSubjects = ["General Knowledge", "Mathematics", "Reasoning", "English", "Science", "History", "Geography", "Polity", "Economy", "Physics", "Chemistry", "Biology"];
const years = [2024, 2023, 2022, 2021, 2020];
const difficulties = ["easy", "medium", "hard"];

type PracticeMode = "calm" | "exam" | "rapid";
type Section = "menu" | "bank_setup" | "predicted_setup" | "practice" | "result";

const LoadingStageText = ({ isPredicted }: { isPredicted: boolean }) => {
  const [stageIdx, setStageIdx] = useState(0);
  const stages = isPredicted
    ? ["Scanning 5-year exam patterns...", "Running 8-factor ML analysis...", "Computing cross-exam correlations...", "Analyzing syllabus coverage gaps...", "Generating unique predicted questions...", "Applying difficulty alignment...", "Finalizing ultra-AI predictions..."]
    : ["Connecting to question bank...", "Applying your filters...", "Loading questions from database...", "Randomizing question order...", "Preparing practice session..."];

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIdx(prev => (prev + 1) % stages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={stageIdx}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }}
        className="text-[11px] text-muted-foreground"
      >
        {stages[stageIdx]}
      </motion.p>
    </AnimatePresence>
  );
};

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
  const [showAnalysis, setShowAnalysis] = useState(false);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, section]);

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

  const loadBankQuestions = async (): Promise<number> => {
    setQuestions([]);
    return await fetchBankQuestions({
      exam_type: selExam || undefined,
      subject: selSubject || undefined,
      year: selYear ? Number(selYear) : undefined,
      difficulty: selDifficulty || undefined,
      count: selCount || undefined,
    });
  };

  const loadPredictedQuestions = async () => {
    setQuestions([]);
    await generatePredicted({
      exam_type: selExam || undefined,
      subject: selSubject || undefined,
      count: selCount,
    });
  };

  // Show message when no questions found after fetch
  const [noQuestionsFound, setNoQuestionsFound] = useState(false);
  // Reset when navigating sections
  useEffect(() => { setNoQuestionsFound(false); }, [section]);

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
                    ML v3.0 ✨
                  </motion.span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  Ultra-Advanced Trend-Based ML Research Engine v3.0 — 8-factor hybrid model analyzing multi-year patterns, cross-exam correlation, syllabus coverage gaps & examiner behavior.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: "Trend Research", glow: true },
                    { label: "8-Factor ML", glow: true },
                    { label: "Cross-Exam Intel", glow: true },
                    { label: "Pattern Drift", glow: false },
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
                <button key={e} onClick={() => {
                  const newExam = selExam === e ? "" : e;
                  setSelExam(newExam);
                  // Clear subject if not valid for new exam
                  if (newExam && examSubjectsMap[newExam] && selSubject && !examSubjectsMap[newExam].includes(selSubject)) {
                    setSelSubject("");
                  }
                }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selExam === e ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >{e}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
            <div className="flex flex-wrap gap-2">
              {(selExam && examSubjectsMap[selExam] ? examSubjectsMap[selExam] : allSubjects).map(s => (
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

        {/* Start Button with Animated Progress */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
              border: "1px solid hsl(var(--primary) / 0.3)",
            }}
          >
            <div className="p-5 space-y-4">
              {/* Animated Icon */}
              <div className="flex justify-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))",
                    border: "1px solid hsl(var(--primary) / 0.3)",
                    boxShadow: "0 0 30px hsl(var(--primary) / 0.15)",
                  }}
                >
                  {isPredicted ? (
                    <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <Sparkles className="w-7 h-7 text-primary" />
                    </motion.div>
                  ) : (
                    <motion.div animate={{ rotateY: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <BookOpen className="w-7 h-7 text-primary" />
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Status Text */}
              <div className="text-center space-y-1">
                <motion.p
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-sm font-bold text-foreground"
                >
                  {isPredicted ? "🧠 AI Research Engine Active" : "📚 Loading Question Bank"}
                </motion.p>
                <LoadingStageText isPredicted={isPredicted} />
              </div>

              {/* Animated Progress Bar */}
              <div className="space-y-2">
                <div className="w-full h-3 rounded-full bg-secondary/80 overflow-hidden relative">
                  <motion.div
                    className="absolute inset-0 opacity-30"
                    style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.8), hsl(var(--primary)))" }}
                    initial={{ width: "0%" }}
                    animate={{ width: ["0%", "30%", "55%", "70%", "85%", "92%"] }}
                    transition={{ duration: 12, times: [0, 0.1, 0.3, 0.5, 0.7, 1], ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between">
                  {(isPredicted
                    ? ["Analyzing", "8-Factor ML", "Cross-Exam", "Generating"]
                    : ["Connecting", "Filtering", "Loading", "Preparing"]
                  ).map((stage, i) => (
                    <motion.span
                      key={stage}
                      initial={{ opacity: 0.3 }}
                      animate={{ opacity: [0.3, 1, 0.5] }}
                      transition={{ duration: 2, delay: i * 2.5, repeat: Infinity }}
                      className="text-[9px] text-muted-foreground font-medium"
                    >
                      {stage}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* Floating dots */}
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "hsl(var(--primary))" }}
                    animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>

            <div className="px-5 py-2.5 border-t border-border/30" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
              <p className="text-[9px] text-muted-foreground text-center italic">
                {isPredicted ? "⚡ Analyzing 5-year patterns with 8-factor ultra-ML model..." : "📦 Fetching authentic previous year questions..."}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {noQuestionsFound && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 text-center"
                style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.2)" }}
              >
                <p className="text-xs text-destructive font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                  No questions found for the selected filters. Try changing your filters or populate the question bank first.
                </p>
              </motion.div>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                setNoQuestionsFound(false);
                if (isPredicted) {
                  await loadPredictedQuestions();
                } else {
                  const count = await loadBankQuestions();
                  if (count === 0) {
                    setNoQuestionsFound(true);
                    return;
                  }
                }
              }}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Practice
            </motion.button>
          </div>
        )}
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

        {/* ─── Authentic Prediction Card ─── */}
        {source === "predicted" && q.probability_score && (() => {
          const pScore = q.probability_score || 65;
          const scoreColor = pScore >= 75 ? "hsl(var(--success))" : pScore >= 65 ? "hsl(var(--primary))" : "hsl(var(--warning))";
          const scoreBg = pScore >= 75 ? "bg-success/10 border-success/25" : pScore >= 65 ? "bg-primary/10 border-primary/25" : "bg-warning/10 border-warning/25";
          const scoreTextClass = pScore >= 75 ? "text-success" : pScore >= 65 ? "text-primary" : "text-warning";
          const mlBadgeClass = q.ml_confidence === "Strong" ? "bg-success/15 text-success" : q.ml_confidence === "Moderate" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning";

          const trendDir = q.trend_direction || "stable";
          const trendIcon = trendDir === "rising" ? "🔴" : trendDir === "declining" ? "🔵" : trendDir === "comeback" ? "⚡" : "🟡";
          const trendLabel = trendDir === "rising" ? "Rising Trend" : trendDir === "declining" ? "Declining Trend" : trendDir === "comeback" ? "Comeback Candidate" : "Stable Trend";
          const trendBadgeClass = trendDir === "rising" ? "bg-destructive/15 text-destructive" : trendDir === "comeback" ? "bg-primary/15 text-primary" : trendDir === "declining" ? "bg-accent/15 text-accent-foreground" : "bg-warning/15 text-warning";

          const momentum = q.trend_momentum || 50;
          const volatility = q.volatility_index || 30;
          const stability = q.pattern_stability || 50;

          return (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`rounded-2xl p-4 border ${scoreBg} space-y-3 relative overflow-hidden`}
            >
              {/* Subtle glow */}
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20 blur-2xl pointer-events-none" style={{ background: scoreColor }} />

              {/* Engine badge */}
              <div className="flex items-center gap-2 relative z-10">
                <span className="px-2 py-0.5 rounded-lg text-[8px] font-bold bg-primary/10 text-primary border border-primary/20">
                  🧠 ULTRA-ML ENGINE v3.0
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[8px] font-semibold bg-secondary text-muted-foreground">
                  8-Factor Hybrid Model
                </span>
                {q.question_type && (
                  <span className="px-2 py-0.5 rounded-lg text-[8px] font-semibold bg-accent/10 text-accent-foreground border border-accent/20 capitalize">
                    {q.question_type}
                  </span>
                )}
              </div>

              {/* Main score row */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-14 h-14 rounded-xl flex items-center justify-center relative"
                    style={{ background: `${scoreColor}20`, border: `1px solid ${scoreColor}40` }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className={`text-xl font-extrabold ${scoreTextClass}`}>{pScore}%</span>
                  </motion.div>
                  <div>
                    <p className={`text-sm font-bold ${scoreTextClass}`}>🔥 Match Probability</p>
                    <p className="text-[10px] text-muted-foreground">📈 Based on Multi-Year Pattern Research</p>
                  </div>
                </div>
              </div>

              {/* Trend & ML badges row */}
              <div className="flex items-center gap-1.5 flex-wrap relative z-10">
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${trendBadgeClass}`}>
                  {trendIcon} {trendLabel}
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${mlBadgeClass}`}>
                  🧠 ML: {q.ml_confidence || "Moderate"}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-secondary text-muted-foreground">
                  📊 Momentum: {momentum}
                </span>
              </div>

              {/* Mini metrics row */}
              <div className="grid grid-cols-3 gap-2 relative z-10">
                <div className="rounded-lg p-2 bg-background/50 border border-border/50 text-center">
                  <p className="text-xs font-bold text-foreground">{momentum}</p>
                  <p className="text-[8px] text-muted-foreground">Momentum</p>
                </div>
                <div className="rounded-lg p-2 bg-background/50 border border-border/50 text-center">
                  <p className="text-xs font-bold text-foreground">{volatility}</p>
                  <p className="text-[8px] text-muted-foreground">Volatility</p>
                </div>
                <div className="rounded-lg p-2 bg-background/50 border border-border/50 text-center">
                  <p className="text-xs font-bold text-foreground">{stability}</p>
                  <p className="text-[8px] text-muted-foreground">Stability</p>
                </div>
              </div>

              {/* Trend reason */}
              {q.trend_reason && (
                <p className="text-[10px] text-muted-foreground leading-relaxed relative z-10">
                  📊 {q.trend_reason}
                </p>
              )}

              {/* Pattern insights */}
              <div className="flex items-center gap-1.5 flex-wrap relative z-10">
                {q.difficulty_evolution && q.difficulty_evolution !== "stable" && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-secondary text-muted-foreground">
                    🎯 {q.difficulty_evolution === "conceptual_shift" ? "Conceptual Shift" : "Factual Shift"}
                  </span>
                )}
                {q.framing_change && q.framing_change !== "stable" && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-medium bg-secondary text-muted-foreground">
                    📝 {q.framing_change === "statement_increase" ? "Statement-Based ↑" : "Case Study ↑"}
                  </span>
                )}
              </div>

              {/* Similar PYQ years */}
              {q.similar_pyq_years && q.similar_pyq_years.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap relative z-10">
                  <span className="text-[9px] text-muted-foreground">Similar in:</span>
                  {q.similar_pyq_years.map(y => (
                    <span key={y} className="px-1.5 py-0.5 rounded bg-secondary text-[9px] font-medium text-foreground">{y}</span>
                  ))}
                </div>
              )}

              {/* View Research toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowAnalysis(!showAnalysis); }}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors relative z-10"
              >
                <Eye className="w-3 h-3" />
                {showAnalysis ? "Hide Research" : "View Research"}
                <ChevronDown className={`w-3 h-3 transition-transform ${showAnalysis ? "rotate-180" : ""}`} />
              </button>

              {/* Expandable research breakdown */}
              <AnimatePresence>
                {showAnalysis && q.score_breakdown && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-2.5 relative z-10 overflow-hidden"
                  >
                    <div className="rounded-xl p-3 bg-background/50 border border-border/50 space-y-2">
                      <p className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                        <BarChart3 className="w-3 h-3 text-primary" /> Hybrid 8-Factor Prediction Model
                      </p>
                      {[
                        { label: "Trend Momentum", value: q.score_breakdown.trend_momentum ?? q.score_breakdown.topic_frequency ?? 0, weight: "20%", icon: "📈" },
                        { label: "Time-Series Forecast", value: q.score_breakdown.time_series_forecast ?? q.score_breakdown.repetition ?? 0, weight: "15%", icon: "⏳" },
                        { label: "Historical Frequency", value: q.score_breakdown.historical_frequency ?? q.score_breakdown.recent_trend ?? 0, weight: "15%", icon: "📊" },
                        { label: "Difficulty Alignment", value: q.score_breakdown.difficulty_alignment ?? q.score_breakdown.difficulty_match ?? 0, weight: "12%", icon: "🎯" },
                        { label: "Semantic Similarity", value: q.score_breakdown.semantic_similarity ?? q.score_breakdown.language_similarity ?? 0, weight: "8%", icon: "🔤" },
                        { label: "Examiner Behavior", value: q.score_breakdown.examiner_behavior ?? 50, weight: "8%", icon: "👤" },
                        { label: "Cross-Exam Correlation", value: q.score_breakdown.cross_exam_correlation ?? 0, weight: "12%", icon: "🌐" },
                        { label: "Syllabus Coverage", value: q.score_breakdown.syllabus_coverage ?? 0, weight: "10%", icon: "📚" },
                      ].map((item) => (
                        <div key={item.label} className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-muted-foreground">{item.icon} {item.label} ({item.weight})</span>
                            <span className="text-[9px] font-bold text-foreground">{item.value}/100</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{
                                background: item.value >= 70 ? "hsl(var(--success))" : item.value >= 40 ? "hsl(var(--primary))" : "hsl(var(--warning))",
                              }}
                              initial={{ width: "0%" }}
                              animate={{ width: `${item.value}%` }}
                              transition={{ duration: 0.8, delay: 0.1 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Trend Direction Visualization */}
                    <div className="rounded-xl p-3 bg-background/50 border border-border/50 space-y-2">
                      <p className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                        <Activity className="w-3 h-3 text-primary" /> Trend Research Insights
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2 bg-secondary/50">
                          <div className="flex items-center gap-1 mb-1">
                            {trendDir === "rising" ? <TrendingUp className="w-3 h-3 text-destructive" /> :
                             trendDir === "declining" ? <TrendingDown className="w-3 h-3 text-accent-foreground" /> :
                             trendDir === "comeback" ? <Zap className="w-3 h-3 text-primary" /> :
                             <Minus className="w-3 h-3 text-warning" />}
                            <span className="text-[9px] font-bold text-foreground">{trendLabel}</span>
                          </div>
                          <p className="text-[8px] text-muted-foreground">Direction detected via linear regression on {q.similar_pyq_years?.length || 5}-year data</p>
                        </div>
                        <div className="rounded-lg p-2 bg-secondary/50">
                          <p className="text-[9px] font-bold text-foreground mb-1">Pattern Evolution</p>
                          <p className="text-[8px] text-muted-foreground">
                            {q.difficulty_evolution === "conceptual_shift" ? "Shifting to conceptual questions" :
                             q.difficulty_evolution === "factual_shift" ? "Shifting to factual questions" :
                             "Difficulty pattern remains consistent"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-warning/5 border border-warning/10">
                      <AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                      <p className="text-[8px] text-muted-foreground leading-relaxed">
                        Prediction is based on multi-year statistical modeling, cross-exam intelligence, and 8-factor hybrid ML analysis. Not a guarantee. Scores are dynamically recalculated using the Ultra-ML Engine v3.0.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })()}

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
          <div className="text-sm font-medium text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown components={{ img: ({ node, ...props }) => <img {...props} className="max-w-full rounded-lg my-2" loading="lazy" /> }}>
              {q.question}
            </ReactMarkdown>
          </div>
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
            <div className="text-xs text-muted-foreground leading-relaxed prose prose-xs dark:prose-invert max-w-none">
              <ReactMarkdown components={{ img: ({ node, ...props }) => <img {...props} className="max-w-full rounded-lg my-2" loading="lazy" /> }}>
                {q.explanation || ""}
              </ReactMarkdown>
            </div>
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

        <MentorSuggestion
          score={accuracy}
          totalQuestions={score.total}
          correctCount={score.correct}
          context="practice"
        />

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
