import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, GraduationCap, BookOpen, Calendar, Plus, X, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const EXAM_TYPES = [
  { id: "neet", label: "NEET", desc: "Medical entrance" },
  { id: "jee", label: "JEE", desc: "Engineering entrance" },
  { id: "upsc", label: "UPSC", desc: "Civil services" },
  { id: "gate", label: "GATE", desc: "Graduate aptitude" },
  { id: "cat", label: "CAT", desc: "Management entrance" },
  { id: "other", label: "Other", desc: "Custom exam" },
];

const STUDY_MODES = [
  { id: "lazy", label: "Chill Mode", desc: "Light daily revision", emoji: "😴" },
  { id: "focus", label: "Focus Mode", desc: "Balanced study plan", emoji: "🎯" },
  { id: "emergency", label: "Emergency Mode", desc: "Intensive cramming", emoji: "🔥" },
];

const OnboardingPage = () => {
  const [step, setStep] = useState(0);
  const [examType, setExamType] = useState("");
  const [customExam, setCustomExam] = useState("");
  const [examDate, setExamDate] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [studyMode, setStudyMode] = useState("");
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const totalSteps = 4;

  const addSubject = () => {
    const trimmed = newSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setNewSubject("");
    }
  };

  const removeSubject = (s: string) => setSubjects(subjects.filter(x => x !== s));

  const canProceed = () => {
    if (step === 0) return examType !== "";
    if (step === 1) return examDate !== "";
    if (step === 2) return subjects.length > 0;
    if (step === 3) return studyMode !== "";
    return false;
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const finalExam = examType === "other" ? customExam || "Custom Exam" : examType.toUpperCase();

      // Update profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          exam_type: finalExam,
          exam_date: examDate,
          study_preferences: { mode: studyMode, onboarded: true },
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      // Create subjects
      for (const name of subjects) {
        const { error: subErr } = await supabase
          .from("subjects")
          .insert({ name, user_id: user.id });
        if (subErr) throw subErr;
      }

      toast({ title: "You're all set! 🧠", description: "Your AI brain is now configured." });
      navigate("/app", { replace: true });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? "bg-primary glow-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl neural-gradient neural-border flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold text-xl text-foreground">ACRY Setup</span>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: Exam Type */}
          {step === 0 && (
            <motion.div key="exam" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">What exam are you preparing for?</h1>
              </div>
              <p className="text-muted-foreground text-sm mb-6">This helps ACRY optimize your study strategy.</p>

              <div className="grid grid-cols-2 gap-3">
                {EXAM_TYPES.map(exam => (
                  <button
                    key={exam.id}
                    onClick={() => setExamType(exam.id)}
                    className={`p-4 rounded-xl text-left transition-all duration-300 ${
                      examType === exam.id
                        ? "neural-gradient neural-border glow-primary"
                        : "glass border border-border hover:border-primary/30"
                    }`}
                  >
                    <p className="font-semibold text-foreground text-sm">{exam.label}</p>
                    <p className="text-[10px] text-muted-foreground">{exam.desc}</p>
                  </button>
                ))}
              </div>

              {examType === "other" && (
                <input
                  type="text"
                  placeholder="Enter your exam name"
                  value={customExam}
                  onChange={e => setCustomExam(e.target.value)}
                  className="w-full mt-3 rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              )}
            </motion.div>
          )}

          {/* Step 1: Exam Date */}
          {step === 1 && (
            <motion.div key="date" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">When's the exam?</h1>
              </div>
              <p className="text-muted-foreground text-sm mb-6">ACRY will build a countdown and pace your revision.</p>

              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-xl bg-secondary border border-border px-4 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />

              {examDate && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-muted-foreground">
                  That's <span className="text-primary font-semibold">
                    {Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                  </span> away. Let's make them count.
                </motion.p>
              )}
            </motion.div>
          )}

          {/* Step 2: Subjects */}
          {step === 2 && (
            <motion.div key="subjects" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Add your subjects</h1>
              </div>
              <p className="text-muted-foreground text-sm mb-6">You can add topics within each subject later.</p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="e.g. Physics, Biology..."
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSubject())}
                  className="flex-1 rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <button
                  onClick={addSubject}
                  disabled={!newSubject.trim()}
                  className="px-4 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {subjects.map(s => (
                  <motion.span
                    key={s}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neural-gradient neural-border text-sm text-foreground"
                  >
                    {s}
                    <button onClick={() => removeSubject(s)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </motion.span>
                ))}
              </div>

              {subjects.length === 0 && (
                <p className="text-xs text-muted-foreground mt-4 text-center">Add at least one subject to continue.</p>
              )}
            </motion.div>
          )}

          {/* Step 3: Study Preferences */}
          {step === 3 && (
            <motion.div key="prefs" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Pick your study style</h1>
              </div>
              <p className="text-muted-foreground text-sm mb-6">ACRY will adapt its recommendations to your pace.</p>

              <div className="space-y-3">
                {STUDY_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setStudyMode(mode.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-300 ${
                      studyMode === mode.id
                        ? "neural-gradient neural-border glow-primary"
                        : "glass border border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-2xl">{mode.emoji}</span>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{mode.label}</p>
                      <p className="text-[10px] text-muted-foreground">{mode.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 rounded-xl glass neural-border text-foreground text-sm font-medium hover:bg-secondary/50 transition-all"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (step < totalSteps - 1) setStep(step + 1);
              else handleFinish();
            }}
            disabled={!canProceed() || loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up..." : step < totalSteps - 1 ? (
              <>Continue <ChevronRight className="w-4 h-4" /></>
            ) : (
              <>Launch ACRY <Sparkles className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
