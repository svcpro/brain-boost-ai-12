import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, BookOpen, Users, BarChart3, Loader2, Brain, FileText,
  Sparkles, Target, TrendingUp, Zap, AlertTriangle, CheckCircle2,
  Clock, Award, Activity, Flame, Eye, Send, Plus, RefreshCw,
  PieChart, ArrowUpRight, ArrowDownRight, Shield, Star, Layers,
  X, ChevronLeft, ChevronRight, Check, Hash, Lightbulb, Play
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AIProgressBar from "@/components/app/AIProgressBar";
import ReactMarkdown from "react-markdown";

// ─── Types ───
interface PracticeSet {
  id: string;
  title: string;
  subject: string;
  topics: string[];
  difficulty: string;
  question_count: number;
  questions: any[];
  ai_generated: boolean;
  status: string;
  assigned_to: string[];
  completion_count: number;
  created_at: string;
  institution_id: string;
  teacher_id: string;
}

interface Submission {
  id: string;
  student_id: string;
  set_id: string;
  score: number | null;
  answers: any;
  time_spent_minutes: number | null;
  submitted_at: string;
}

interface ClassPerformance {
  students: number;
  active_students: number;
  total_study_minutes: number;
  avg_minutes_per_student: number;
  subject_performance: { subject: string; avg_strength: number; student_count: number }[];
  weak_students: { user_id: string; avg_strength: number }[];
  sessions_last_30d: number;
}

// ─── Animated Stat Card ───
const StatCard = ({ label, value, icon: Icon, color, delay = 0, trend }: {
  label: string; value: string | number; icon: any; color: string; delay?: number;
  trend?: { value: number; up: boolean } | null;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ delay, duration: 0.5, type: "spring" }}
    className="relative group overflow-hidden rounded-2xl border border-border/40 bg-card/80 backdrop-blur-xl p-4 hover:border-primary/30 transition-all duration-500"
  >
    {/* Glow effect */}
    <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 ${color}`} />
    <div className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-700 ${color}`} />
    
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} bg-opacity-15`}
             style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.15))` }}>
          <Icon className="w-4.5 h-4.5 text-primary" />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trend.up ? "text-emerald-400" : "text-rose-400"}`}>
            {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.value}%
          </div>
        )}
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.3 }}
        className="text-2xl font-black text-foreground tracking-tight block"
      >
        {value}
      </motion.span>
      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
    </div>
  </motion.div>
);

// ─── Strength Bar ───
const StrengthBar = ({ value, label, color }: { value: number; label: string; color: string }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">{label}</span>
      <span className={`text-[10px] font-bold ${value >= 70 ? "text-emerald-400" : value >= 40 ? "text-amber-400" : "text-rose-400"}`}>{value}%</span>
    </div>
    <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`}
        style={{
          background: value >= 70 ? "linear-gradient(90deg, hsl(142 71% 45%), hsl(142 71% 55%))"
            : value >= 40 ? "linear-gradient(90deg, hsl(38 92% 50%), hsl(45 93% 55%))"
            : "linear-gradient(90deg, hsl(0 72% 51%), hsl(0 72% 61%))"
        }}
      />
    </div>
  </div>
);

// ─── Score Ring ───
const ScoreRing = ({ score, size = 40 }: { score: number; size?: number }) => {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "hsl(142, 71%, 45%)" : score >= 40 ? "hsl(38, 92%, 50%)" : "hsl(0, 72%, 51%)";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="text-[9px] font-black fill-foreground" transform={`rotate(90 ${size / 2} ${size / 2})`}>
        {Math.round(score)}
      </text>
    </svg>
  );
};

// ─── Question Preview Modal ───
const QuestionPreviewModal = ({ set, onClose }: { set: PracticeSet; onClose: () => void }) => {
  const questions: any[] = Array.isArray(set.questions) ? set.questions : [];
  const [currentQ, setCurrentQ] = useState(0);
  const [studentMode, setStudentMode] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let interval: any;
    if (timerRunning) interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const q = questions[currentQ];
  const options = q?.options || q?.choices || [];
  const correctIndex = typeof q?.correct_answer === "number" ? q.correct_answer 
    : typeof q?.answer === "number" ? q.answer 
    : options.findIndex((o: any) => o.is_correct || o.correct);
  const hasAnswered = selectedAnswers[currentQ] !== undefined;
  const isCorrect = hasAnswered && selectedAnswers[currentQ] === correctIndex;

  const handleSelect = (idx: number) => {
    if (!studentMode || hasAnswered) return;
    setSelectedAnswers(prev => ({ ...prev, [currentQ]: idx }));
    setShowExplanation(prev => ({ ...prev, [currentQ]: true }));
  };

  const totalAnswered = Object.keys(selectedAnswers).length;
  const totalCorrect = Object.entries(selectedAnswers).filter(([qi, ai]) => {
    const quest = questions[Number(qi)];
    const opts = quest?.options || quest?.choices || [];
    const ci = typeof quest?.correct_answer === "number" ? quest.correct_answer 
      : typeof quest?.answer === "number" ? quest.answer 
      : opts.findIndex((o: any) => o.is_correct || o.correct);
    return ai === ci;
  }).length;

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (questions.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          className="bg-card border border-border/40 rounded-2xl p-8 text-center max-w-sm w-full" onClick={e => e.stopPropagation()}>
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-1">No Questions Found</h3>
          <p className="text-xs text-muted-foreground mb-4">This practice set has no questions data stored.</p>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-primary/15 text-primary text-xs font-bold">Close</button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3" onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        className="bg-card/95 border border-border/40 rounded-2xl backdrop-blur-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-gradient-to-r from-primary/5 to-accent/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              {set.ai_generated ? <Brain className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground truncate max-w-[200px]">{set.title}</h3>
              <p className="text-[10px] text-muted-foreground">{set.subject} • {questions.length} questions • {set.difficulty}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Student mode toggle */}
            <button onClick={() => { setStudentMode(!studentMode); if (!studentMode) { setTimerRunning(true); } else { setTimerRunning(false); setTimer(0); setSelectedAnswers({}); setShowExplanation({}); } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                studentMode ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}>
              <Play className="w-3 h-3" />
              {studentMode ? "Exit Student View" : "Student View"}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Student mode stats bar */}
        {studentMode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            className="flex items-center justify-between px-5 py-2 border-b border-border/20 bg-secondary/20 text-[10px] font-bold shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">⏱ {formatTime(timer)}</span>
              <span className="text-muted-foreground">Answered: <span className="text-foreground">{totalAnswered}/{questions.length}</span></span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">✓ {totalCorrect}</span>
              <span className="text-rose-400">✗ {totalAnswered - totalCorrect}</span>
              {totalAnswered > 0 && (
                <span className="text-primary">{Math.round(totalCorrect / totalAnswered * 100)}%</span>
              )}
            </div>
          </motion.div>
        )}

        {/* Question navigator dots */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-border/20 overflow-x-auto shrink-0">
          {questions.map((_, i) => {
            const answered = selectedAnswers[i] !== undefined;
            const correct = answered && (() => {
              const quest = questions[i];
              const opts = quest?.options || quest?.choices || [];
              const ci = typeof quest?.correct_answer === "number" ? quest.correct_answer
                : typeof quest?.answer === "number" ? quest.answer
                : opts.findIndex((o: any) => o.is_correct || o.correct);
              return selectedAnswers[i] === ci;
            })();
            return (
              <button key={i} onClick={() => setCurrentQ(i)}
                className={`w-6 h-6 rounded-md text-[9px] font-bold transition-all shrink-0 ${
                  i === currentQ ? "bg-primary text-primary-foreground scale-110 shadow-md" 
                  : answered && studentMode ? (correct ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30")
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70"
                }`}>
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div key={currentQ}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}>

              {/* Question number & text */}
              <div className="flex items-start gap-3 mb-4">
                <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-black text-primary">
                  {currentQ + 1}
                </span>
                <div className="flex-1">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-foreground leading-relaxed">
                    <ReactMarkdown>{q?.question || q?.text || q?.title || "No question text"}</ReactMarkdown>
                  </div>
                  {q?.difficulty && (
                    <span className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      q.difficulty === "hard" ? "bg-rose-500/15 text-rose-400" 
                      : q.difficulty === "medium" ? "bg-amber-500/15 text-amber-400" 
                      : "bg-emerald-500/15 text-emerald-400"
                    }`}>
                      {q.difficulty}
                    </span>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2 ml-11">
                {options.map((opt: any, oi: number) => {
                  const optText = typeof opt === "string" ? opt : opt.text || opt.label || opt.option || String(opt);
                  const isSelected = selectedAnswers[currentQ] === oi;
                  const isCorrectOpt = oi === correctIndex;
                  const revealed = !studentMode || hasAnswered;
                  
                  return (
                    <motion.button key={oi}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: oi * 0.05 }}
                      onClick={() => handleSelect(oi)}
                      disabled={!studentMode || hasAnswered}
                      className={`w-full text-left rounded-xl border p-3 transition-all duration-300 ${
                        revealed && isCorrectOpt
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : isSelected && !isCorrect
                          ? "border-rose-500/40 bg-rose-500/10"
                          : isSelected
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/30 bg-secondary/20 hover:border-primary/20 hover:bg-secondary/40"
                      } ${studentMode && !hasAnswered ? "cursor-pointer" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          revealed && isCorrectOpt ? "bg-emerald-500/20 text-emerald-400" 
                          : isSelected && !isCorrect ? "bg-rose-500/20 text-rose-400"
                          : "bg-secondary/50 text-muted-foreground"
                        }`}>
                          {revealed && isCorrectOpt ? <Check className="w-3 h-3" /> 
                            : isSelected && !isCorrect ? <X className="w-3 h-3" /> 
                            : String.fromCharCode(65 + oi)}
                        </span>
                        <span className="text-xs text-foreground flex-1">
                          <ReactMarkdown>{optText}</ReactMarkdown>
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Explanation */}
              {((!studentMode || showExplanation[currentQ]) && (q?.explanation || q?.hint)) && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="ml-11 mt-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Explanation</span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-muted-foreground">
                    <ReactMarkdown>{q.explanation || q.hint}</ReactMarkdown>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 bg-secondary/10 shrink-0">
          <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary/50 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all">
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>
          <span className="text-[10px] font-bold text-muted-foreground">
            {currentQ + 1} / {questions.length}
          </span>
          <button onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))} disabled={currentQ === questions.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-xs font-bold text-primary hover:bg-primary/25 disabled:opacity-30 transition-all">
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Generate Form ───
const GenerateForm = ({ onGenerate, generating }: { onGenerate: (data: any) => void; generating: boolean }) => {
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    if (!subject.trim()) return;
    onGenerate({
      subject: subject.trim(),
      topics: topics.split(",").map(t => t.trim()).filter(Boolean),
      difficulty,
      question_count: questionCount,
      title: title.trim() || undefined,
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/90 to-accent/5 backdrop-blur-xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">AI Practice Set Generator</h3>
          <p className="text-[10px] text-muted-foreground">Generate adaptive question sets with AI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Title (optional)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Unit 3 Quiz"
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Subject *</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Physics"
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Topics (comma separated)</label>
          <input value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g. Optics, Waves"
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/30 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors">
              <option value="mixed">Mixed</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Questions</label>
            <input type="number" value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} min={5} max={30}
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/30 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors" />
          </div>
        </div>
      </div>

      <button onClick={handleSubmit} disabled={generating || !subject.trim()}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40">
        {generating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Generating with AI...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Practice Set</span>
          </>
        )}
      </button>
      {generating && <AIProgressBar label="AI generating questions" compact estimatedSeconds={15} />}
    </motion.div>
  );
};

// ─── Main Dashboard ───
export default function TeacherModeAdmin() {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [practiceSets, setPracticeSets] = useState<PracticeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [classPerf, setClassPerf] = useState<ClassPerformance | null>(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const [previewSet, setPreviewSet] = useState<PracticeSet | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [setsRes, subsRes] = await Promise.all([
      supabase.from("teacher_practice_sets").select("*").order("created_at", { ascending: false }),
      supabase.from("practice_set_submissions").select("*").order("submitted_at", { ascending: false }).limit(50),
    ]);
    setPracticeSets((setsRes.data as any[]) || []);
    setSubmissions((subsRes.data as any[]) || []);
    setLoading(false);
  };

  const loadClassPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("teacher-practice", {
        body: { action: "class_performance" },
      });
      if (error) throw error;
      setClassPerf(data);
    } catch (e: any) {
      toast({ title: "Error loading class analytics", description: e.message, variant: "destructive" });
    } finally {
      setPerfLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (tab === "analytics") loadClassPerformance(); }, [tab]);

  const handleGenerate = async (data: any) => {
    setGenerating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("teacher-practice", {
        body: { action: "generate", ...data },
      });
      if (error) throw error;
      toast({ title: "Practice Set Created!", description: `${result.question_count} questions generated by AI` });
      setShowGenerator(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (setId: string) => {
    await supabase.from("teacher_practice_sets").update({ status: "published" }).eq("id", setId);
    toast({ title: "Published!" });
    loadData();
  };

  const stats = {
    totalSets: practiceSets.length,
    published: practiceSets.filter(s => s.status === "published").length,
    drafts: practiceSets.filter(s => s.status === "draft").length,
    aiGenerated: practiceSets.filter(s => s.ai_generated).length,
    totalSubmissions: submissions.length,
    totalQuestions: practiceSets.reduce((s, p) => s + (p.question_count || 0), 0),
    avgScore: submissions.length > 0
      ? Math.round(submissions.reduce((s, sub) => s + (sub.score || 0), 0) / submissions.length)
      : 0,
    passRate: submissions.length > 0
      ? Math.round(submissions.filter(s => (s.score || 0) >= 70).length / submissions.length * 100)
      : 0,
  };

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    published: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    archived: "bg-muted text-muted-foreground border-border/30",
  };

  const DIFFICULTY_ICONS: Record<string, any> = {
    easy: { icon: Shield, color: "text-emerald-400" },
    medium: { icon: Target, color: "text-amber-400" },
    hard: { icon: Flame, color: "text-rose-400" },
    mixed: { icon: Layers, color: "text-primary" },
  };

  return (
    <div className="space-y-5">
      {/* ── Hero Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-primary/10 via-card/95 to-accent/10 backdrop-blur-xl p-5">
        {/* Animated orbs */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-accent/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <GraduationCap className="w-6 h-6 text-primary" />
            </motion.div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">AI Teacher Mode</h2>
              <p className="text-xs text-muted-foreground">Adaptive practice sets • Class analytics • AI-powered insights</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadData()} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowGenerator(!showGenerator)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Generate Set</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Generator ── */}
      <AnimatePresence>
        {showGenerator && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <GenerateForm onGenerate={handleGenerate} generating={generating} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Practice Sets" value={stats.totalSets} icon={FileText} color="bg-primary" delay={0} />
        <StatCard label="Published" value={stats.published} icon={BookOpen} color="bg-emerald-500" delay={0.05} />
        <StatCard label="AI Generated" value={stats.aiGenerated} icon={Brain} color="bg-accent" delay={0.1} />
        <StatCard label="Total Questions" value={stats.totalQuestions} icon={Target} color="bg-amber-500" delay={0.15} />
        <StatCard label="Submissions" value={stats.totalSubmissions} icon={Users} color="bg-blue-500" delay={0.2} />
        <StatCard label="Avg Score" value={`${stats.avgScore}%`} icon={BarChart3} color="bg-primary" delay={0.25}
          trend={stats.avgScore > 0 ? { value: stats.avgScore >= 60 ? 12 : -8, up: stats.avgScore >= 60 } : null} />
        <StatCard label="Pass Rate" value={`${stats.passRate}%`} icon={CheckCircle2} color="bg-emerald-500" delay={0.3}
          trend={stats.passRate > 0 ? { value: stats.passRate >= 70 ? 5 : -3, up: stats.passRate >= 70 } : null} />
        <StatCard label="Drafts" value={stats.drafts} icon={Clock} color="bg-amber-500" delay={0.35} />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/30 backdrop-blur-sm border border-border/20 p-1 rounded-xl">
          {[
            { value: "overview", label: "Practice Sets", icon: FileText },
            { value: "submissions", label: "Submissions", icon: Users },
            { value: "analytics", label: "Class Analytics", icon: BarChart3 },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value}
              className="text-xs gap-1.5 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all">
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Practice Sets Tab ── */}
        <TabsContent value="overview" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : practiceSets.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary/60" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">No Practice Sets Yet</h3>
              <p className="text-[10px] text-muted-foreground mb-4">Generate your first AI-powered practice set</p>
              <button onClick={() => setShowGenerator(true)}
                className="px-4 py-2 rounded-xl bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition-colors">
                <Plus className="w-3 h-3 inline mr-1" /> Create First Set
              </button>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              {practiceSets.map((set, i) => {
                const diffInfo = DIFFICULTY_ICONS[set.difficulty] || DIFFICULTY_ICONS.mixed;
                const DiffIcon = diffInfo.icon;
                return (
                  <motion.div key={set.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group rounded-2xl border border-border/30 bg-card/80 backdrop-blur-sm p-4 hover:border-primary/20 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center shrink-0">
                        {set.ai_generated ? <Brain className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground truncate">{set.title}</span>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[set.status] || "bg-secondary text-muted-foreground"}`}>
                            {set.status}
                          </span>
                          {set.ai_generated && (
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                              ✨ AI
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> {set.subject}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Target className="w-3 h-3" /> {set.question_count} Q
                          </span>
                          <span className={`text-[10px] flex items-center gap-1 ${diffInfo.color}`}>
                            <DiffIcon className="w-3 h-3" /> {set.difficulty}
                          </span>
                          {set.topics?.length > 0 && (
                            <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
                              {set.topics.slice(0, 2).join(", ")}{set.topics.length > 2 ? ` +${set.topics.length - 2}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-lg font-black text-foreground">{set.completion_count || 0}</span>
                          <p className="text-[9px] text-muted-foreground">done</p>
                        </div>
                        <button onClick={() => setPreviewSet(set)}
                          className="p-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors opacity-0 group-hover:opacity-100"
                          title="Preview Questions">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {set.status === "draft" && (
                          <button onClick={() => handlePublish(set.id)}
                            className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors opacity-0 group-hover:opacity-100">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Submissions Tab ── */}
        <TabsContent value="submissions" className="mt-4">
          {submissions.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-border/20 p-12 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-foreground mb-1">No Submissions Yet</h3>
              <p className="text-[10px] text-muted-foreground">Publish a practice set and wait for students to attempt it</p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {/* Score distribution header */}
              <div className="rounded-2xl border border-border/30 bg-card/80 backdrop-blur-sm p-4 mb-3">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Score Distribution</h4>
                <div className="flex items-end gap-1 h-16">
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(bucket => {
                    const count = submissions.filter(s => {
                      const score = s.score || 0;
                      return score >= bucket && score < bucket + 10;
                    }).length;
                    const height = submissions.length > 0 ? (count / submissions.length) * 100 : 0;
                    const color = bucket >= 70 ? "bg-emerald-500/60" : bucket >= 40 ? "bg-amber-500/60" : "bg-rose-500/60";
                    return (
                      <motion.div key={bucket} className="flex-1 flex flex-col items-center gap-0.5"
                        initial={{ height: 0 }} animate={{ height: "auto" }} transition={{ delay: bucket * 0.02 }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(height, 2)}%` }}
                          transition={{ duration: 0.8, delay: bucket * 0.03 }}
                          className={`w-full rounded-t ${color} min-h-[2px]`}
                        />
                        <span className="text-[7px] text-muted-foreground/60">{bucket}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {submissions.map((sub, i) => (
                <motion.div key={sub.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-3 flex items-center gap-3 hover:border-primary/15 transition-all"
                >
                  <ScoreRing score={sub.score || 0} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-foreground">Student {sub.student_id.slice(0, 8)}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {sub.time_spent_minutes || 0} min
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </div>
                  <div className={`text-sm font-black ${(sub.score || 0) >= 70 ? "text-emerald-400" : (sub.score || 0) >= 40 ? "text-amber-400" : "text-rose-400"}`}>
                    {sub.score != null ? `${Math.round(sub.score)}%` : "—"}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Analytics Tab ── */}
        <TabsContent value="analytics" className="mt-4">
          {perfLoading ? (
            <div className="space-y-3">
              <AIProgressBar label="Loading class analytics" compact estimatedSeconds={8} />
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            </div>
          ) : !classPerf ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-border/20 p-12 text-center">
              <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No class data available</p>
              <button onClick={loadClassPerformance} className="mt-3 px-4 py-2 rounded-xl bg-primary/15 text-primary text-xs font-bold">
                <RefreshCw className="w-3 h-3 inline mr-1" /> Retry
              </button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {/* Class overview cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Students" value={classPerf.students || 0} icon={Users} color="bg-blue-500" delay={0} />
                <StatCard label="Active (30d)" value={classPerf.active_students || 0} icon={Activity} color="bg-emerald-500" delay={0.05}
                  trend={classPerf.students > 0 ? { value: Math.round((classPerf.active_students || 0) / classPerf.students * 100), up: true } : null} />
                <StatCard label="Study Minutes" value={(classPerf.total_study_minutes || 0).toLocaleString()} icon={Clock} color="bg-accent" delay={0.1} />
                <StatCard label="Sessions (30d)" value={classPerf.sessions_last_30d || 0} icon={TrendingUp} color="bg-primary" delay={0.15} />
              </div>

              {/* Subject Performance */}
              {(classPerf.subject_performance || []).length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="rounded-2xl border border-border/30 bg-card/80 backdrop-blur-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold text-foreground">Subject Performance</h3>
                    <span className="text-[9px] text-muted-foreground ml-auto">{(classPerf.subject_performance || []).length} subjects</span>
                  </div>
                  <div className="space-y-3">
                    {(classPerf.subject_performance || []).map((sp, i) => (
                      <motion.div key={sp.subject} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.05 }}>
                        <StrengthBar value={sp.avg_strength} label={`${sp.subject} (${sp.student_count} students)`} color="" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Weak Students */}
              {(classPerf.weak_students || []).length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent backdrop-blur-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs font-bold text-foreground">At-Risk Students</h3>
                    <span className="text-[9px] bg-rose-500/15 text-rose-400 px-2 py-0.5 rounded-full font-bold ml-auto">
                      {(classPerf.weak_students || []).length} students
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(classPerf.weak_students || []).slice(0, 8).map((ws, i) => (
                      <motion.div key={ws.user_id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.35 + i * 0.04 }}
                        className="rounded-xl border border-rose-500/10 bg-card/60 p-3 text-center"
                      >
                        <ScoreRing score={ws.avg_strength} size={36} />
                        <p className="text-[9px] text-muted-foreground mt-1.5 truncate">{ws.user_id.slice(0, 8)}...</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewSet && <QuestionPreviewModal set={previewSet} onClose={() => setPreviewSet(null)} />}
      </AnimatePresence>
    </div>
  );
}
