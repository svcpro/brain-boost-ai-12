import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, GraduationCap, BookOpen, Calendar, Plus, X, ChevronRight, Sparkles, Hash, Wand2, Loader2, MessageSquare, Phone } from "lucide-react";
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

const SUGGESTED_SUBJECTS: Record<string, string[]> = {
  neet: ["Physics", "Chemistry", "Biology (Botany)", "Biology (Zoology)"],
  jee: ["Physics", "Chemistry", "Mathematics"],
  upsc: ["History", "Geography", "Polity", "Economics", "Science & Technology", "Environment", "Ethics"],
  gate: ["Engineering Mathematics", "General Aptitude", "Core Subject"],
  cat: ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
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

const STUDY_MODES = [
  { id: "lazy", label: "Chill Mode", desc: "Light daily revision", emoji: "😴" },
  { id: "focus", label: "Focus Mode", desc: "Balanced study plan", emoji: "🎯" },
  { id: "emergency", label: "Emergency Mode", desc: "Intensive cramming", emoji: "🔥" },
];

const OnboardingPage = () => {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [examType, setExamType] = useState("");
  const [customExam, setCustomExam] = useState("");
  const [examDate, setExamDate] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [topicsBySubject, setTopicsBySubject] = useState<Record<string, string[]>>({});
  const [newTopic, setNewTopic] = useState("");
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [studyMode, setStudyMode] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("+91 ");
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Prefill name from auth metadata (Google/Apple provide full_name or name)
  useState(() => {
    const meta = user?.user_metadata;
    const name = meta?.full_name || meta?.name || meta?.display_name || "";
    if (name) setDisplayName(name);
  });

  const totalSteps = 7;

  const addSubject = () => {
    const trimmed = newSubject.trim();
    if (trimmed && !subjects.includes(trimmed)) {
      setSubjects([...subjects, trimmed]);
      setTopicsBySubject(prev => ({ ...prev, [trimmed]: [] }));
      setNewSubject("");
    }
  };

  const removeSubject = (s: string) => {
    setSubjects(subjects.filter(x => x !== s));
    setTopicsBySubject(prev => {
      const copy = { ...prev };
      delete copy[s];
      return copy;
    });
    if (activeSubject === s) setActiveSubject(null);
  };

  const addTopic = (subject: string) => {
    const trimmed = newTopic.trim();
    if (trimmed && !(topicsBySubject[subject] || []).includes(trimmed)) {
      setTopicsBySubject(prev => ({
        ...prev,
        [subject]: [...(prev[subject] || []), trimmed],
      }));
      setNewTopic("");
    }
  };

  const addSuggestedTopic = (subject: string, topic: string) => {
    if (!(topicsBySubject[subject] || []).includes(topic)) {
      setTopicsBySubject(prev => ({
        ...prev,
        [subject]: [...(prev[subject] || []), topic],
      }));
    }
  };

  const removeTopic = (subject: string, topic: string) => {
    setTopicsBySubject(prev => ({
      ...prev,
      [subject]: (prev[subject] || []).filter(t => t !== topic),
    }));
  };

  const handleAIGenerate = async () => {
    const examLabel = examType === "other" ? customExam || "Custom Exam" : examType.toUpperCase();
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-topic-manager", {
        body: { action: "generate_curriculum", exam_type: examLabel, custom_exam: customExam },
      });
      if (error) throw error;
      const curriculum = data as { subjects: { name: string; topics: { name: string }[] }[] };
      if (curriculum?.subjects?.length) {
        const newSubjects: string[] = [];
        const newTopics: Record<string, string[]> = { ...topicsBySubject };
        for (const sub of curriculum.subjects) {
          if (!subjects.includes(sub.name) && !newSubjects.includes(sub.name)) {
            newSubjects.push(sub.name);
          }
          const subName = sub.name;
          const existingTopics = newTopics[subName] || [];
          const aiTopics = (sub.topics || []).map(t => t.name).filter(t => !existingTopics.includes(t));
          newTopics[subName] = [...existingTopics, ...aiTopics];
        }
        setSubjects(prev => [...prev, ...newSubjects]);
        setTopicsBySubject(newTopics);
        toast({ title: "AI Curriculum Generated ✨", description: `Added ${newSubjects.length} subjects with topics.` });
      }
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e.message || "Try again later", variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return displayName.trim().length >= 2;
    if (step === 1) return examType !== "";
    if (step === 2) return examDate !== "";
    if (step === 3) return subjects.length > 0;
    if (step === 4) return true; // topics are optional
    if (step === 5) return studyMode !== "";
    if (step === 6) return true; // whatsapp is optional
    return false;
  };

  // Initialize activeSubject when entering topics step
  const handleNext = () => {
    if (step === 3 && subjects.length > 0 && !activeSubject) {
      setActiveSubject(subjects[0]);
    }
    if (step < totalSteps - 1) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const finalExam = examType === "other" ? customExam || "Custom Exam" : examType.toUpperCase();

      const profileUpdate: any = {
        display_name: displayName.trim(),
        exam_type: finalExam,
        exam_date: examDate,
        study_preferences: { mode: studyMode, onboarded: true },
      };

      // Save WhatsApp number if provided
      if (whatsappNumber.trim()) {
        profileUpdate.whatsapp_number = whatsappNumber.trim();
        profileUpdate.whatsapp_opted_in = whatsappOptIn;
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      // Create subjects and their topics
      for (const name of subjects) {
        const { data: subData, error: subErr } = await supabase
          .from("subjects")
          .insert({ name, user_id: user.id })
          .select("id")
          .single();
        if (subErr) throw subErr;

        const topics = topicsBySubject[name] || [];
        for (const topicName of topics) {
          const { error: topicErr } = await supabase
            .from("topics")
            .insert({ name: topicName, subject_id: subData.id, user_id: user.id });
          if (topicErr) throw topicErr;
        }
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

  const totalTopics = Object.values(topicsBySubject).reduce((s, t) => s + t.length, 0);

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
          {/* Step 0: Your Name */}
          {step === 0 && (
            <motion.div key="name" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">What should we call you?</h1>
              </div>
              <p className="text-muted-foreground text-sm mb-6">ACRY will use your name across the app — greetings, voice alerts, and more.</p>

              <input
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && canProceed()) handleNext(); }}
                autoFocus
                maxLength={50}
                className="w-full rounded-xl bg-secondary border border-border px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />

              {displayName.trim().length >= 2 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-muted-foreground">
                  Welcome, <span className="text-primary font-semibold">{displayName.trim()}</span> 👋
                </motion.p>
              )}
            </motion.div>
          )}

          {/* Step 1: Exam Type */}
          {step === 1 && (
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

          {/* Step 2: Exam Date */}
          {step === 2 && (
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

          {/* Step 3: Subjects */}
          {step === 3 && (
            <motion.div key="subjects" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h1 className="text-2xl font-bold text-foreground">Add your subjects</h1>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-4">You'll add topics for each subject next.</p>

              {/* AI Generate Button */}
              <button
                onClick={handleAIGenerate}
                disabled={aiGenerating}
                className="w-full flex items-center justify-center gap-2 py-3 mb-4 rounded-xl border border-dashed border-primary/40 text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
              >
                {aiGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating with AI...</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Auto-Generate Subjects & Topics with AI</>
                )}
              </button>

              {SUGGESTED_SUBJECTS[examType] && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Suggested for {EXAM_TYPES.find(e => e.id === examType)?.label}:</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_SUBJECTS[examType]
                      .filter(s => !subjects.includes(s))
                      .map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setSubjects(prev => [...prev, s]);
                            setTopicsBySubject(prev => ({ ...prev, [s]: [] }));
                          }}
                          className="px-3 py-1.5 rounded-full border border-dashed border-primary/40 text-xs text-primary hover:bg-primary/10 transition-all"
                        >
                          + {s}
                        </button>
                      ))}
                    {SUGGESTED_SUBJECTS[examType].every(s => subjects.includes(s)) && (
                      <span className="text-xs text-muted-foreground">All suggested subjects added ✓</span>
                    )}
                  </div>
                </div>
              )}

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

          {/* Step 4: Topics per Subject */}
          {step === 4 && (
            <motion.div key="topics" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">Add topics</h1>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Add key topics for each subject. {totalTopics > 0 && <span className="text-primary">{totalTopics} topics added</span>}
              </p>

              {/* Subject tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                {subjects.map(s => {
                  const count = (topicsBySubject[s] || []).length;
                  return (
                    <button
                      key={s}
                      onClick={() => { setActiveSubject(s); setNewTopic(""); }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        activeSubject === s
                          ? "bg-primary text-primary-foreground"
                          : "glass border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                    </button>
                  );
                })}
              </div>

              {activeSubject && (
                <div className="space-y-3">
                  {/* Suggested topics */}
                  {SUGGESTED_TOPICS[activeSubject] && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Suggested topics:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SUGGESTED_TOPICS[activeSubject]
                          .filter(t => !(topicsBySubject[activeSubject] || []).includes(t))
                          .map(t => (
                            <button
                              key={t}
                              onClick={() => addSuggestedTopic(activeSubject, t)}
                              className="px-2.5 py-1 rounded-full border border-dashed border-primary/40 text-[11px] text-primary hover:bg-primary/10 transition-all"
                            >
                              + {t}
                            </button>
                          ))}
                        {SUGGESTED_TOPICS[activeSubject].every(t => (topicsBySubject[activeSubject] || []).includes(t)) && (
                          <span className="text-[11px] text-muted-foreground">All added ✓</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Add custom topic */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Add topic to ${activeSubject}...`}
                      value={newTopic}
                      onChange={e => setNewTopic(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTopic(activeSubject))}
                      className="flex-1 rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                    <button
                      onClick={() => addTopic(activeSubject)}
                      disabled={!newTopic.trim()}
                      className="px-3 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-30 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Added topics */}
                  <div className="flex flex-wrap gap-1.5">
                    {(topicsBySubject[activeSubject] || []).map(t => (
                      <motion.span
                        key={t}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full neural-gradient neural-border text-xs text-foreground"
                      >
                        {t}
                        <button onClick={() => removeTopic(activeSubject, t)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </motion.span>
                    ))}
                  </div>

                  {(topicsBySubject[activeSubject] || []).length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center">No topics yet — add some or skip to continue.</p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 5: Study Preferences */}
          {step === 5 && (
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
          {/* Step 6: WhatsApp Number (Optional) */}
          {step === 6 && (
            <motion.div key="whatsapp" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">WhatsApp notifications</h1>
              </div>
              <p className="text-muted-foreground text-sm mb-6">
                Get study reminders, risk digests, and streak alerts on WhatsApp. <span className="text-muted-foreground/70">(Optional)</span>
              </p>

              <div className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                    maxLength={20}
                    className="w-full rounded-xl bg-secondary border border-border pl-10 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Enter your WhatsApp number with country code.
                </p>

                {whatsappNumber.trim().length >= 10 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl glass border border-border"
                  >
                    <button
                      onClick={() => setWhatsappOptIn(!whatsappOptIn)}
                      className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${whatsappOptIn ? "bg-primary" : "bg-secondary"}`}
                    >
                      <motion.div
                        className="w-4 h-4 rounded-full bg-white absolute top-1"
                        animate={{ left: whatsappOptIn ? 22 : 4 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                    <span className="text-xs text-foreground">
                      Enable WhatsApp notifications
                    </span>
                  </motion.div>
                )}
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
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up..." : step < totalSteps - 1 ? (
              <>{step === 4 ? (totalTopics > 0 ? "Continue" : "Skip for now") : step === 6 ? (whatsappNumber.trim() ? "Continue" : "Skip") : "Continue"} <ChevronRight className="w-4 h-4" /></>
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
