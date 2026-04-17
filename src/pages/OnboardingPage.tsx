import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, BookOpen, Calendar as CalendarIcon, Plus, X, ChevronRight, Sparkles, Hash, Wand2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TAB_GLOW = "#00E5FF";

const EXAM_CATEGORIES = [
  { id: "government", label: "🏛️ Government" },
  { id: "entrance", label: "🎓 Entrance" },
  { id: "global", label: "🌍 Global" },
] as const;

type ExamEntry = { id: string; label: string; desc: string; category: string };

const EXAM_TYPES: ExamEntry[] = [
  // Government
  { id: "ssc_cgl", label: "SSC CGL", desc: "Staff Selection", category: "government" },
  { id: "ibps_po", label: "IBPS PO", desc: "Banking", category: "government" },
  { id: "sbi_po", label: "SBI PO", desc: "Banking", category: "government" },
  { id: "rrb_ntpc", label: "RRB NTPC", desc: "Railways", category: "government" },
  { id: "rrb_group_d", label: "RRB Group D", desc: "Railways", category: "government" },
  { id: "nda", label: "NDA", desc: "Defence", category: "government" },
  { id: "cds", label: "CDS", desc: "Defence", category: "government" },
  { id: "state_psc", label: "State PSC", desc: "State Services", category: "government" },
  { id: "ugc_net", label: "UGC NET", desc: "Lectureship", category: "government" },
  { id: "other_gov", label: "Other", desc: "Custom Exam", category: "government" },
  // Entrance
  { id: "jee_advanced", label: "JEE Advanced", desc: "IIT Entry", category: "entrance" },
  { id: "neet_ug", label: "NEET UG", desc: "Medical", category: "entrance" },
  { id: "cat", label: "CAT", desc: "MBA / IIM", category: "entrance" },
  { id: "gate", label: "GATE", desc: "M.Tech / PSU", category: "entrance" },
  { id: "clat", label: "CLAT", desc: "Law / NLU", category: "entrance" },
  { id: "cuet_ug", label: "CUET UG", desc: "Central Unis", category: "entrance" },
  { id: "bitsat", label: "BITSAT", desc: "BITS Pilani", category: "entrance" },
  { id: "nift", label: "NIFT", desc: "Fashion Design", category: "entrance" },
  { id: "xat", label: "XAT", desc: "XLRI / MBA", category: "entrance" },
  { id: "other_ent", label: "Other", desc: "Custom Exam", category: "entrance" },
  // Global
  { id: "sat", label: "SAT", desc: "US Colleges", category: "global" },
  { id: "gre", label: "GRE", desc: "Grad School", category: "global" },
  { id: "gmat", label: "GMAT", desc: "Business School", category: "global" },
  { id: "ielts", label: "IELTS", desc: "English Prof.", category: "global" },
  { id: "toefl", label: "TOEFL", desc: "English Prof.", category: "global" },
  { id: "usmle", label: "USMLE", desc: "US Medical", category: "global" },
  { id: "cfa", label: "CFA", desc: "Finance", category: "global" },
  { id: "cpa", label: "CPA", desc: "Accounting", category: "global" },
  { id: "mcat", label: "MCAT", desc: "Medical", category: "global" },
  { id: "acca", label: "ACCA", desc: "Accounting", category: "global" },
  { id: "other_global", label: "Other", desc: "Custom Exam", category: "global" },
];

const SUGGESTED_SUBJECTS: Record<string, string[]> = {
  neet_ug: ["Physics", "Chemistry", "Biology (Botany)", "Biology (Zoology)"],
  jee_advanced: ["Physics", "Chemistry", "Mathematics"],
  cat: ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
  gate: ["Engineering Mathematics", "General Aptitude", "Core Subject"],
  ssc_cgl: ["General Intelligence", "English Language", "Quantitative Aptitude", "General Awareness"],
  ibps_po: ["Reasoning", "English Language", "Quantitative Aptitude", "General Awareness", "Computer Aptitude"],
  nda: ["Mathematics", "General Ability Test", "English", "General Knowledge"],
  ugc_net: ["General Paper", "Subject Paper"],
  sat: ["Math", "Evidence-Based Reading", "Writing"],
  gre: ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
  gmat: ["Quantitative", "Verbal", "Integrated Reasoning", "Analytical Writing"],
  clat: ["English", "Current Affairs", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques"],
  state_psc: ["General Studies", "CSAT", "Optional Subject"],
};

const SUGGESTED_TOPICS: Record<string, string[]> = {
  "Physics": ["Mechanics", "Thermodynamics", "Optics", "Electromagnetism", "Modern Physics", "Waves"],
  "Chemistry": ["Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Chemical Bonding", "Electrochemistry"],
  "Biology (Botany)": ["Plant Anatomy", "Plant Physiology", "Genetics", "Ecology", "Cell Biology"],
  "Biology (Zoology)": ["Human Physiology", "Animal Kingdom", "Evolution", "Reproductive Biology", "Biotechnology"],
  "Mathematics": ["Calculus", "Algebra", "Coordinate Geometry", "Trigonometry", "Probability & Statistics", "Vectors"],
  "History": ["Ancient India", "Medieval India", "Modern India", "World History"],
  "Geography": ["Physical Geography", "Human Geography", "Indian Geography", "Climatology"],
  "Polity": ["Constitution", "Governance", "Panchayati Raj", "Judiciary"],
  "Economics": ["Microeconomics", "Macroeconomics", "Indian Economy", "Banking"],
  "Quantitative Aptitude": ["Arithmetic", "Algebra", "Geometry", "Number Systems"],
  "Verbal Ability": ["Reading Comprehension", "Para Jumbles", "Sentence Correction", "Vocabulary"],
  "Data Interpretation": ["Tables", "Bar Graphs", "Pie Charts", "Caselets"],
  "Logical Reasoning": ["Arrangements", "Puzzles", "Syllogisms", "Blood Relations"],
};

// Validates that user input looks like a real word/subject (rejects gibberish like "KKKKK", "HJKKJH")
// Returns { valid: boolean, reason?: string }
const validateAcademicTerm = (raw: string): { valid: boolean; reason?: string } => {
  const text = raw.trim();
  if (text.length < 3) return { valid: false, reason: "Too short — use at least 3 characters." };
  if (text.length > 60) return { valid: false, reason: "Too long — keep it under 60 characters." };

  // Must contain at least one letter
  if (!/[A-Za-z]/.test(text)) return { valid: false, reason: "Use letters, not just symbols or numbers." };

  // Strip to letters only for linguistic checks
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return { valid: false, reason: "Add a real subject/topic name." };

  // Must contain at least one vowel
  if (!/[aeiouyAEIOUY]/.test(letters)) {
    return { valid: false, reason: "That doesn't look like a real word. Try again." };
  }

  // Reject single-letter spam (e.g. "KKKKK", "aaaa")
  const uniqueLetters = new Set(letters.toLowerCase());
  if (uniqueLetters.size < 3) return { valid: false, reason: "That doesn't look like a real word." };

  // Reject 3+ same letters in a row (e.g. "AAAA", "kkk")
  if (/([A-Za-z])\1{2,}/.test(text)) return { valid: false, reason: "Too many repeated letters." };

  // Reject 4+ consonants in a row (gibberish like "HJKKJH", "BCDFG", "JKLM")
  if (/[BCDFGHJKLMNPQRSTVWXZbcdfghjklmnpqrstvwxz]{4,}/.test(text)) {
    return { valid: false, reason: "That doesn't look like a real word. Try again." };
  }

  // Per-word vowel ratio check (≥20% vowels per word)
  const words = text.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
  for (const w of words) {
    const wLetters = w.replace(/[^A-Za-z]/g, "");
    if (wLetters.length < 2) continue;
    const wVowels = (wLetters.match(/[aeiouyAEIOUY]/g) || []).length;
    if (wVowels === 0 || wVowels / wLetters.length < 0.2) {
      return { valid: false, reason: `"${w}" doesn't look like a real word.` };
    }
  }

  return { valid: true };
};

const STUDY_MODES = [
  { id: "lazy", label: "Chill Mode", desc: "Light daily revision", emoji: "😴" },
  { id: "focus", label: "Focus Mode", desc: "Balanced study plan", emoji: "🎯" },
  { id: "emergency", label: "Emergency Mode", desc: "Intensive cramming", emoji: "🔥" },
];

const OnboardingPage = () => {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [examType, setExamType] = useState("");
  const [examCategory, setExamCategory] = useState("government");
  const [customExam, setCustomExam] = useState("");
  const [examDate, setExamDate] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, string[]>>({});
  const [newTopic, setNewTopic] = useState("");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiProgressLabel, setAiProgressLabel] = useState("");

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Pre-fill display name from auth metadata once user becomes available.
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata as Record<string, any> | undefined;
    const name = meta?.full_name || meta?.name || meta?.display_name || "";
    if (name && !displayName) setDisplayName(name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSteps = 6;

  // Intercept the browser/device back button so users on /onboarding don't get
  // bounced back to /auth (which would force a fresh OTP). Instead the back
  // gesture moves to the previous onboarding step. On step 0 it stays put.
  useEffect(() => {
    // Push a sentinel state so the first Back press fires popstate on us.
    window.history.pushState({ acryOnboarding: true }, "");

    const handlePopState = (_e: PopStateEvent) => {
      // Always re-arm the sentinel so the next Back press is also captured.
      window.history.pushState({ acryOnboarding: true }, "");
      setStep((s) => (s > 0 ? s - 1 : 0));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);


  const addSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    const check = validateAcademicTerm(trimmed);
    if (!check.valid) {
      toast({ title: "Invalid subject name", description: check.reason, variant: "destructive" });
      return;
    }
    if (!subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setTopicsBySubject(prev => ({ ...prev, [trimmed]: [] }));
      setNewSubject("");
    }
  };

  const removeSubject = (s: string) => {
    setSubjects(subjects.filter(x => x !== s));
    setTopicsBySubject(prev => { const copy = { ...prev }; delete copy[s]; return copy; });
    if (activeSubject === s) setActiveSubject(null);
  };

  const addTopic = (subject: string) => {
    const trimmed = newTopic.trim();
    if (!trimmed) return;
    const check = validateAcademicTerm(trimmed);
    if (!check.valid) {
      toast({ title: "Invalid topic name", description: check.reason, variant: "destructive" });
      return;
    }
    if (!(topicsBySubject[subject] || []).includes(trimmed)) {
      setTopicsBySubject(prev => ({ ...prev, [subject]: [...(prev[subject] || []), trimmed] }));
      setNewTopic("");
    }
  };

  const addSuggestedTopic = (subject: string, topic: string) => {
    if (!(topicsBySubject[subject] || []).includes(topic)) {
      setTopicsBySubject(prev => ({ ...prev, [subject]: [...(prev[subject] || []), topic] }));
    }
  };

  const removeTopic = (subject: string, topic: string) => {
    setTopicsBySubject(prev => ({ ...prev, [subject]: (prev[subject] || []).filter(t => t !== topic) }));
  };

  const handleAIGenerate = async () => {
    const isOther = examType.startsWith("other_");
    const selectedExam = EXAM_TYPES.find(e => e.id === examType);
    const examLabel = isOther ? (customExam || "Custom Exam") : (selectedExam?.label || examType.toUpperCase());
    setAiGenerating(true);
    setAiProgress(0);
    setAiProgressLabel("Initializing AI...");

    // Simulate progress steps while waiting for AI
    const progressSteps = [
      { target: 15, label: "Analyzing exam pattern...", delay: 400 },
      { target: 35, label: "Mapping syllabus structure...", delay: 1200 },
      { target: 55, label: "Generating subjects...", delay: 2500 },
      { target: 70, label: "Creating topic hierarchy...", delay: 4000 },
      { target: 85, label: "Assigning weightages...", delay: 6000 },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const step of progressSteps) {
      timers.push(setTimeout(() => {
        setAiProgress(step.target);
        setAiProgressLabel(step.label);
      }, step.delay));
    }

    try {
      const { data, error } = await supabase.functions.invoke("ai-topic-manager", {
        body: { action: "generate_curriculum", exam_type: examLabel },
      });
      if (error) throw error;

      // Complete progress
      setAiProgress(95);
      setAiProgressLabel("Processing results...");

      const curriculum = data as { subjects: { name: string; topics: { name: string }[] }[] };
      if (curriculum?.subjects?.length) {
        const newSubjects: string[] = [];
        const newTopics: Record<string, string[]> = { ...topicsBySubject };
        for (const sub of curriculum.subjects) {
          if (!subjects.includes(sub.name) && !newSubjects.includes(sub.name)) newSubjects.push(sub.name);
          const existingTopics = newTopics[sub.name] || [];
          const aiTopics = (sub.topics || []).map(t => t.name).filter(t => !existingTopics.includes(t));
          newTopics[sub.name] = [...existingTopics, ...aiTopics];
        }
        setSubjects(prev => [...prev, ...newSubjects]);
        setTopicsBySubject(newTopics);
        setAiProgress(100);
        setAiProgressLabel("Done! ✨");
        toast({ title: "AI Curriculum Generated ✨", description: `Added ${newSubjects.length} subjects with topics.` });
      }
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e.message || "Try again later", variant: "destructive" });
    } finally {
      timers.forEach(clearTimeout);
      setTimeout(() => {
        setAiGenerating(false);
        setAiProgress(0);
        setAiProgressLabel("");
      }, 800);
    }
  };

  const canProceed = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return examType !== "" && (!examType.startsWith("other_") || validateAcademicTerm(customExam).valid);
    if (step === 2) return examDate !== "";
    if (step === 3) return subjects.length > 0;
    if (step === 4) return true;
    if (step === 5) return studyMode !== "";
    return false;
  };

  const handleNext = () => {
    if (step === 3 && subjects.length > 0 && !activeSubject) setActiveSubject(subjects[0]);
    if (step < totalSteps - 1) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isOther = examType.startsWith("other_");
      const selectedExam = EXAM_TYPES.find(e => e.id === examType);
      const finalExam = isOther ? (customExam || "Custom Exam") : (selectedExam?.label || examType.toUpperCase());
      // Final defense: validate every subject + topic before saving (catches edge cases)
      for (const s of subjects) {
        const sCheck = validateAcademicTerm(s);
        if (!sCheck.valid) {
          toast({ title: `Invalid subject: "${s}"`, description: sCheck.reason, variant: "destructive" });
          setStep(3); setLoading(false); return;
        }
        for (const t of topicsBySubject[s] || []) {
          const tCheck = validateAcademicTerm(t);
          if (!tCheck.valid) {
            toast({ title: `Invalid topic: "${t}"`, description: tCheck.reason, variant: "destructive" });
            setStep(4); setActiveSubject(s); setLoading(false); return;
          }
        }
      }
      if (isOther) {
        const eCheck = validateAcademicTerm(customExam);
        if (!eCheck.valid) {
          toast({ title: "Invalid exam name", description: eCheck.reason, variant: "destructive" });
          setStep(1); setLoading(false); return;
        }
      }

      // Use upsert to defend against rare cases where the auth trigger hasn't yet
      // created the profile row — without this, an UPDATE silently affects 0 rows
      // and onboarded never persists, causing an infinite redirect loop on /app.
      const { error: profileErr } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: displayName.trim(),
        exam_type: finalExam,
        exam_date: examDate,
        study_preferences: { mode: studyMode, onboarded: true },
      }, { onConflict: "id" });
      if (profileErr) throw profileErr;

      for (const name of subjects) {
        const { data: subData, error: subErr } = await supabase.from("subjects").insert({ name, user_id: user.id }).select("id").single();
        if (subErr) throw subErr;
        for (const topicName of (topicsBySubject[name] || [])) {
          const { error: topicErr } = await supabase.from("topics").insert({ name: topicName, subject_id: subData.id, user_id: user.id });
          if (topicErr) throw topicErr;
        }
      }

      const { emitEvent } = await import("@/lib/eventBus");
      emitEvent("profile_completed", { exam_type: finalExam, subjects: subjects.length }, { title: "Profile Set Up!", body: "Your brain is configured." });
      emitEvent("exam_setup", { exam_type: finalExam, exam_date: examDate }, { title: "Exam Target Set!", body: `Preparing for ${finalExam}` });

      toast({ title: "You're all set! 🧠", description: "Your AI brain is now configured." });
      // Notify dashboard to refetch the freshly-saved profile (display_name, etc.)
      try { window.dispatchEvent(new CustomEvent("profile-updated")); } catch {}
      navigate("/app", { replace: true });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  const totalTopics = Object.values(topicsBySubject).reduce((s, t) => s + t.length, 0);
  const stepIcons = [Sparkles, GraduationCap, CalendarIcon, BookOpen, Hash, Sparkles];
  const StepIcon = stepIcons[step] || Sparkles;
  const stepLabels = ["Name", "Exam", "Date", "Subjects", "Topics", "Style"];

  const inputStyle = {
    background: "#ffffff08",
    border: "1px solid #ffffff0a",
    color: "#ffffffdd",
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ background: "linear-gradient(180deg, #0B0F1A 0%, #111827 100%)" }}
    >
      {/* Device frame */}
      <div className="relative w-full max-w-[430px] h-[100dvh] overflow-hidden flex flex-col md:h-[min(95dvh,920px)] md:rounded-[2.5rem] md:border md:border-border/40 md:shadow-[0_25px_80px_-12px_hsl(0_0%_0%/0.6),0_0_120px_hsl(187_100%_50%/0.06)]">

        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-[280px] h-[280px] rounded-full"
            style={{ top: "-8%", right: "-15%", background: "radial-gradient(circle, #00E5FF06 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[220px] h-[220px] rounded-full"
            style={{ bottom: "10%", left: "-10%", background: "radial-gradient(circle, #7C4DFF05 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          {Array.from({ length: 8 }, (_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 1 + Math.random() * 1.5, height: 1 + Math.random() * 1.5,
                left: `${15 + Math.random() * 70}%`, top: `${15 + Math.random() * 70}%`,
                background: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#7C4DFF" : "#00FF94",
              }}
              animate={{ y: [0, -12, 0], opacity: [0.05, 0.2, 0.05] }}
              transition={{ duration: 5 + Math.random() * 5, delay: Math.random() * 3, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-5 pt-4 pb-2 relative z-10"
        >
          <div className="flex items-center gap-2">
            {/* Mini logo */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(228 50% 8%), hsl(228 40% 14%))", border: "1px solid #00E5FF25" }}
            >
              <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                <defs>
                  <linearGradient id="obGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00E5FF" />
                    <stop offset="100%" stopColor="#7C4DFF" />
                  </linearGradient>
                </defs>
                <path d="M24 8L38 38H10L24 8Z" stroke="url(#obGrad)" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
                <line x1="15" y1="30" x2="33" y2="30" stroke="url(#obGrad)" strokeWidth="2" opacity="0.7" />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-wide" style={{ color: "#ffffffcc" }}>Setup</span>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              key={step}
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <StepIcon className="w-3.5 h-3.5" style={{ color: "#00E5FF" }} />
            </motion.div>
            <span className="text-[11px] font-medium" style={{ color: "#ffffff40" }}>{step + 1}/{totalSteps}</span>
          </div>
        </motion.div>

        {/* Progress bar */}
        <div className="flex gap-1 px-5 mb-1 relative z-10">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.div
              key={i}
              className="h-[3px] flex-1 rounded-full"
              animate={{
                background: i <= step ? "#00E5FF" : "#ffffff0a",
                boxShadow: i <= step ? "0 0 6px #00E5FF40" : "none",
              }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            />
          ))}
        </div>

        {/* Step label pills */}
        <div className="flex gap-1.5 px-5 mt-2 mb-3 relative z-10 overflow-x-auto scrollbar-hide">
          {stepLabels.map((label, i) => (
            <motion.span
              key={i}
              className="flex-shrink-0 px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider"
              style={{
                background: i === step ? "#00E5FF15" : "#ffffff04",
                border: `1px solid ${i === step ? "#00E5FF30" : "#ffffff06"}`,
                color: i === step ? "#00E5FF" : i < step ? "#ffffff30" : "#ffffff15",
              }}
              animate={{ scale: i === step ? 1 : 0.95 }}
            >
              {label}
            </motion.span>
          ))}
        </div>

        {/* Content area */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 mx-5 rounded-2xl p-4 overflow-y-auto min-h-0 relative z-10"
          style={{
            background: "#ffffff05",
            border: "1px solid #ffffff0a",
            backdropFilter: "blur(20px)",
          }}
        >
          <AnimatePresence mode="wait">
            {/* Step 0: Name */}
            {step === 0 && (
              <motion.div key="name" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  <h1 className="text-lg font-bold" style={{ color: "#ffffffee" }}>What should we call you?</h1>
                </div>
                <p className="text-xs mb-4" style={{ color: "#ffffff40" }}>ACRY will use your name across the app.</p>
                <input
                  type="text" placeholder="Enter your name" value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && canProceed()) handleNext(); }}
                  autoFocus maxLength={50}
                  className="w-full rounded-xl px-4 py-2.5 text-sm placeholder:opacity-40 focus:outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "#00E5FF30"}
                  onBlur={(e) => e.target.style.borderColor = "#ffffff0a"}
                />
                {displayName.trim().length >= 2 && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 text-xs" style={{ color: "#ffffff40" }}>
                    Welcome, <span className="font-semibold" style={{ color: "#00E5FF" }}>{displayName.trim()}</span> 👋
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* Step 1: Exam Type */}
            {step === 1 && (
              <motion.div key="exam" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2 mb-1">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <GraduationCap className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  </motion.div>
                  <h1 className="text-lg font-bold" style={{ color: "#ffffffee" }}>Your exam?</h1>
                </div>
                <p className="text-xs mb-3" style={{ color: "#ffffff40" }}>Pick your target exam. ACRY will customize everything.</p>

                {/* Single unified glowing container for all tabs */}
                <div
                  className="relative rounded-2xl p-1.5 mb-3 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${TAB_GLOW}10, ${TAB_GLOW}04, ${TAB_GLOW}08)`,
                    border: `1.5px solid ${TAB_GLOW}20`,
                    boxShadow: `0 0 25px ${TAB_GLOW}08, 0 0 50px ${TAB_GLOW}04, inset 0 0 20px ${TAB_GLOW}04`,
                  }}
                >
                  {/* Shared shimmer sweep across entire container */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      background: `linear-gradient(105deg, transparent 35%, ${TAB_GLOW}10 50%, transparent 65%)`,
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                  />
                  {/* Shared breathing glow */}
                  <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                      width: 180, height: 60,
                      top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      background: `radial-gradient(ellipse, ${TAB_GLOW}0a, transparent)`,
                    }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />

                  <div className="flex gap-1.5 relative z-10">
                    {EXAM_CATEGORIES.map((cat) => {
                      const isActive = examCategory === cat.id;
                      return (
                        <motion.button
                          key={cat.id}
                          whileTap={{ scale: 0.92 }}
                          whileHover={{ scale: 1.03 }}
                          onClick={() => setExamCategory(cat.id)}
                          className="flex-1 py-2 rounded-xl text-[10px] font-bold tracking-wider relative overflow-hidden"
                          style={{
                            background: isActive ? `${TAB_GLOW}18` : "transparent",
                            border: `1.5px solid ${isActive ? `${TAB_GLOW}50` : "transparent"}`,
                            color: isActive ? TAB_GLOW : "#ffffff40",
                            boxShadow: isActive ? `0 0 12px ${TAB_GLOW}15` : "none",
                          }}
                        >
                          {isActive && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full"
                              style={{ background: TAB_GLOW, boxShadow: `0 0 6px ${TAB_GLOW}` }}
                            />
                          )}
                          <span className="relative z-10">{cat.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Exam grid with stagger + glow */}
                <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-hide">
                  <AnimatePresence mode="popLayout">
                    {EXAM_TYPES.filter(e => e.category === examCategory).map((exam, i) => {
                      const catColor = TAB_GLOW;
                      const isSelected = examType === exam.id;
                      const isOtherOption = exam.id.startsWith("other_");
                      return (
                        <motion.button
                          key={exam.id}
                          layout
                          initial={{ opacity: 0, scale: 0.85, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85, y: -10 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: i * 0.04 }}
                          whileTap={{ scale: 0.92 }}
                          whileHover={{ scale: 1.04, y: -2 }}
                          onClick={() => setExamType(exam.id)}
                          className="p-2.5 rounded-xl text-center relative overflow-hidden group"
                          style={{
                            background: isSelected
                              ? `linear-gradient(145deg, ${catColor}18, ${catColor}08)`
                              : isOtherOption
                                ? "linear-gradient(135deg, #ffffff08, #ffffff04)"
                                : "#ffffff04",
                            border: `1.5px solid ${isSelected ? `${catColor}60` : isOtherOption ? "#ffffff15" : "#ffffff08"}`,
                            boxShadow: isSelected
                              ? `0 4px 25px ${catColor}20, 0 0 40px ${catColor}08, inset 0 1px 0 ${catColor}15`
                              : "none",
                          }}
                        >
                          {/* Selection glow */}
                          {isSelected && (
                            <>
                              <motion.div
                                className="absolute inset-0 rounded-xl"
                                style={{ background: `radial-gradient(circle at 50% 30%, ${catColor}12, transparent 70%)` }}
                                animate={{ opacity: [0.5, 1, 0.5] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              />
                              {/* Orbiting particle */}
                              <motion.div
                                className="absolute w-1 h-1 rounded-full"
                                style={{ background: catColor, boxShadow: `0 0 4px ${catColor}` }}
                                animate={{
                                  x: [0, 20, 20, 0, 0],
                                  y: [0, 0, 20, 20, 0],
                                  opacity: [0.6, 1, 0.6, 1, 0.6],
                                }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              />
                              {/* Check indicator */}
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center z-20"
                                style={{ background: catColor, boxShadow: `0 0 8px ${catColor}60` }}
                              >
                                <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </motion.div>
                            </>
                          )}
                          {/* Other option special icon */}
                          {isOtherOption && (
                            <motion.div
                              className="mx-auto mb-0.5 w-5 h-5 rounded-full flex items-center justify-center relative z-10"
                              style={{ background: "#ffffff08", border: "1px dashed #ffffff20" }}
                              animate={isSelected ? { borderColor: catColor, background: `${catColor}15` } : {}}
                            >
                              <Plus className="w-3 h-3" style={{ color: isSelected ? catColor : "#ffffff40" }} />
                            </motion.div>
                          )}
                          <p className="font-bold text-[11px] relative z-10" style={{ color: isSelected ? catColor : "#ffffffcc" }}>
                            {exam.label}
                          </p>
                          <p className="text-[8px] mt-0.5 relative z-10" style={{ color: isSelected ? `${catColor}aa` : "#ffffff30" }}>
                            {exam.desc}
                          </p>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Custom exam input for "Other" */}
                {examType.startsWith("other_") && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3">
                    <input
                      type="text" placeholder="Type your exam name..." value={customExam}
                      onChange={e => setCustomExam(e.target.value)}
                      autoFocus
                      className="w-full rounded-xl px-4 py-2.5 text-sm placeholder:opacity-30 focus:outline-none transition-all"
                      style={{
                        background: "#ffffff08",
                        border: "1.5px solid #ffffff15",
                        color: "#ffffffdd",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = `${TAB_GLOW}50`;
                        e.target.style.boxShadow = `0 0 15px ${TAB_GLOW}10`;
                      }}
                      onBlur={(e) => { e.target.style.borderColor = "#ffffff15"; e.target.style.boxShadow = "none"; }}
                    />
                  </motion.div>
                )}

                {/* Selection confirmation */}
                {examType && !examType.startsWith("other_") && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${TAB_GLOW}08, transparent)`,
                      border: `1px solid ${TAB_GLOW}20`,
                    }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-3 h-3" style={{ color: TAB_GLOW }} />
                    </motion.div>
                    <p className="text-[10px]" style={{ color: `${TAB_GLOW}aa` }}>
                      Locked in: <span className="font-bold" style={{ color: TAB_GLOW }}>
                        {EXAM_TYPES.find(e => e.id === examType)?.label}
                      </span>
                    </p>
                  </motion.div>
                )}
                {examType.startsWith("other_") && customExam.trim() && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "#00FF9408", border: "1px solid #00FF9420" }}
                  >
                    <Sparkles className="w-3 h-3" style={{ color: "#00FF94" }} />
                    <p className="text-[10px]" style={{ color: "#00FF94aa" }}>Custom: <span className="font-bold" style={{ color: "#00FF94" }}>{customExam}</span></p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Step 2: Exam Date */}
            {step === 2 && (
              <motion.div key="date" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <CalendarIcon className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  <h1 className="text-lg font-bold" style={{ color: "#ffffffee" }}>When's the exam?</h1>
                </div>
                <p className="text-xs mb-4" style={{ color: "#ffffff40" }}>ACRY will build a countdown and pace your revision.</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-left transition-all focus:outline-none"
                      style={{
                        ...inputStyle,
                        color: examDate ? "#ffffffdd" : "#ffffff40",
                      }}
                    >
                      <CalendarIcon className="w-3.5 h-3.5" style={{ color: "#ffffff30" }} />
                      {examDate ? format(new Date(examDate), "PPP") : "Pick your exam date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                    <Calendar mode="single" selected={examDate ? new Date(examDate) : undefined}
                      onSelect={(date) => { if (date) setExamDate(date.toISOString().split("T")[0]); }}
                      disabled={(date) => date < new Date()} initialFocus className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {examDate && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 text-xs" style={{ color: "#ffffff40" }}>
                    That's <span className="font-semibold" style={{ color: "#00E5FF" }}>{Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days</span> away.
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* Step 3: Subjects */}
            {step === 3 && (
              <motion.div key="subjects" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <BookOpen className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  <h1 className="text-lg font-bold" style={{ color: "#ffffffee" }}>Add your subjects</h1>
                </div>
                <p className="text-xs mb-3" style={{ color: "#ffffff40" }}>You'll add topics for each subject next.</p>

                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAIGenerate} disabled={aiGenerating}
                  className="w-full flex items-center justify-center gap-2 py-2 mb-1 rounded-xl text-xs disabled:opacity-50 transition-all"
                  style={{ border: "1px dashed #00E5FF40", color: "#00E5FF", background: "#00E5FF06" }}
                >
                  {aiGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Wand2 className="w-3.5 h-3.5" /> AI Generate Subjects & Topics</>}
                </motion.button>

                {/* AI Progress Bar */}
                <AnimatePresence>
                  {aiGenerating && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 rounded-xl overflow-hidden px-1"
                    >
                      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "#ffffff08" }}>
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            background: "linear-gradient(90deg, #00E5FF, #7C4DFF, #00E5FF)",
                            backgroundSize: "200% 100%",
                          }}
                          initial={{ width: "0%" }}
                          animate={{
                            width: `${aiProgress}%`,
                            backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
                          }}
                          transition={{
                            width: { duration: 0.6, ease: "easeOut" },
                            backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" },
                          }}
                        />
                        {/* Shimmer effect */}
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: "linear-gradient(90deg, transparent, #ffffff20, transparent)",
                            backgroundSize: "50% 100%",
                          }}
                          animate={{ backgroundPosition: ["-100% 0%", "200% 0%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 mb-1">
                        <motion.p
                          key={aiProgressLabel}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-medium"
                          style={{ color: "#00E5FFcc" }}
                        >
                          {aiProgressLabel}
                        </motion.p>
                        <span className="text-[10px] font-bold" style={{ color: "#00E5FF80" }}>{aiProgress}%</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {SUGGESTED_SUBJECTS[examType] && (
                  <div className="mb-3">
                    <p className="text-[10px] mb-1.5" style={{ color: "#ffffff30" }}>Suggested:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_SUBJECTS[examType].filter(s => !subjects.includes(s)).map(s => (
                        <button key={s} onClick={() => { setSubjects(prev => [...prev, s]); setTopicsBySubject(prev => ({ ...prev, [s]: [] })); }}
                          className="px-2.5 py-1 rounded-full text-[10px] transition-all"
                          style={{ border: "1px dashed #00E5FF35", color: "#00E5FF90", background: "#00E5FF04" }}
                        >+ {s}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {subjects.map(s => (
                    <motion.span key={s} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                      style={{ background: "#00E5FF10", border: "1px solid #00E5FF25", color: "#ffffffcc" }}
                    >
                      {s}
                      <button onClick={() => removeSubject(s)} className="transition-colors hover:opacity-70" style={{ color: "#ffffff40" }}><X className="w-2.5 h-2.5" /></button>
                    </motion.span>
                  ))}
                </div>
                {subjects.length === 0 && <p className="text-[10px] mt-3 text-center" style={{ color: "#ffffff25" }}>Add at least one subject to continue.</p>}
              </motion.div>
            )}

            {/* Step 4: Topics */}
            {step === 4 && (
              <motion.div key="topics" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Hash className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  <h1 className="text-lg font-bold" style={{ color: "#ffffffee" }}>Add topics</h1>
                </div>
                <p className="text-xs mb-3" style={{ color: "#ffffff40" }}>
                  Key topics for each subject. {totalTopics > 0 && <span style={{ color: "#00E5FF" }}>{totalTopics} added</span>}
                </p>

                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {subjects.map(s => {
                    const count = (topicsBySubject[s] || []).length;
                    return (
                      <button key={s} onClick={() => { setActiveSubject(s); setNewTopic(""); }}
                        className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                        style={{
                          background: activeSubject === s ? "#00E5FF" : "#ffffff06",
                          border: `1px solid ${activeSubject === s ? "#00E5FF" : "#ffffff0a"}`,
                          color: activeSubject === s ? "#0B0F1A" : "#ffffff50",
                        }}
                      >{s} {count > 0 && `(${count})`}</button>
                    );
                  })}
                </div>

                {activeSubject && (
                  <div className="space-y-2.5">
                    {SUGGESTED_TOPICS[activeSubject] && (
                      <div>
                        <p className="text-[10px] mb-1.5" style={{ color: "#ffffff30" }}>Suggested:</p>
                        <div className="flex flex-wrap gap-1">
                          {SUGGESTED_TOPICS[activeSubject].filter(t => !(topicsBySubject[activeSubject] || []).includes(t)).map(t => (
                            <button key={t} onClick={() => addSuggestedTopic(activeSubject, t)}
                              className="px-2 py-0.5 rounded-full text-[9px] transition-all"
                              style={{ border: "1px dashed #00E5FF30", color: "#00E5FF80", background: "#00E5FF04" }}
                            >+ {t}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(topicsBySubject[activeSubject] || []).map(t => (
                        <motion.span key={t} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                          style={{ background: "#00E5FF08", border: "1px solid #00E5FF18", color: "#ffffffbb" }}
                        >
                          {t}
                          <button onClick={() => removeTopic(activeSubject, t)} className="transition-colors hover:opacity-70" style={{ color: "#ffffff35" }}><X className="w-2 h-2" /></button>
                        </motion.span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 5: Study Style */}
            {step === 5 && (
              <motion.div key="prefs" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  <h1 className="text-lg font-bold" style={{ color: "#ffffffee" }}>Your study style</h1>
                </div>
                <p className="text-xs mb-4" style={{ color: "#ffffff40" }}>ACRY adapts recommendations to your pace.</p>
                <div className="space-y-2">
                  {STUDY_MODES.map(mode => (
                    <motion.button whileTap={{ scale: 0.97 }} key={mode.id} onClick={() => setStudyMode(mode.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-300"
                      style={{
                        background: studyMode === mode.id ? "linear-gradient(135deg, #00E5FF10, #7C4DFF08)" : "#ffffff04",
                        border: `1px solid ${studyMode === mode.id ? "#00E5FF40" : "#ffffff08"}`,
                        boxShadow: studyMode === mode.id ? "0 0 15px #00E5FF10" : "none",
                      }}
                    >
                      <span className="text-xl">{mode.emoji}</span>
                      <div>
                        <p className="font-semibold text-xs" style={{ color: studyMode === mode.id ? "#00E5FF" : "#ffffffcc" }}>{mode.label}</p>
                        <p className="text-[9px]" style={{ color: "#ffffff35" }}>{mode.desc}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Bottom Nav */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2.5 px-5 pt-3 pb-6 relative z-10"
        >
          {step > 0 && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setStep(step - 1)}
              className="px-5 py-2.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: "#ffffff06", border: "1px solid #ffffff0a", color: "#ffffff80" }}
            >Back</motion.button>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleNext} disabled={!canProceed() || loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              color: "#0B0F1A",
              boxShadow: canProceed() ? "0 0 20px #00E5FF15, 0 0 40px #7C4DFF08" : "none",
            }}
          >
            {loading ? "Setting up..." : step < totalSteps - 1 ? (
              <>{step === 4 ? (totalTopics > 0 ? "Continue" : "Skip for now") : "Continue"} <ChevronRight className="w-3.5 h-3.5" /></>
            ) : (
              <>Launch ACRY <Sparkles className="w-3.5 h-3.5" /></>
            )}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default OnboardingPage;
