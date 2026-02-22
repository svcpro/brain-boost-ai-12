import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Upload, RefreshCw, TrendingUp, Database, Zap, BarChart3, AlertTriangle, Loader2, Target, Layers, Sparkles, Trash2, Pencil, Search, CheckSquare, Square, X, Download, Filter, BookOpen, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STQ_EXAM_TYPES = [
  // Government
  { id: "SSC CGL", category: "Government" },
  { id: "IBPS PO", category: "Government" },
  { id: "SBI PO", category: "Government" },
  { id: "RRB NTPC", category: "Government" },
  { id: "RRB Group D", category: "Government" },
  { id: "NDA", category: "Government" },
  { id: "CDS", category: "Government" },
  { id: "State PSC", category: "Government" },
  { id: "UGC NET", category: "Government" },
  // Entrance
  { id: "JEE Advanced", category: "Entrance" },
  { id: "NEET UG", category: "Entrance" },
  { id: "CAT", category: "Entrance" },
  { id: "GATE", category: "Entrance" },
  { id: "CLAT", category: "Entrance" },
  { id: "CUET UG", category: "Entrance" },
  { id: "BITSAT", category: "Entrance" },
  { id: "NIFT", category: "Entrance" },
  { id: "XAT", category: "Entrance" },
  // Global
  { id: "SAT", category: "Global" },
  { id: "GRE", category: "Global" },
  { id: "GMAT", category: "Global" },
  { id: "IELTS", category: "Global" },
  { id: "TOEFL", category: "Global" },
  { id: "USMLE", category: "Global" },
  { id: "CFA", category: "Global" },
  { id: "CPA", category: "Global" },
  { id: "MCAT", category: "Global" },
  { id: "ACCA", category: "Global" },
];

const STQ_EXAM_SUBJECTS: Record<string, string[]> = {
  "JEE Advanced": ["Physics", "Chemistry", "Mathematics"],
  "NEET UG": ["Physics", "Chemistry", "Biology"],
  "CAT": ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
  "GATE": ["Engineering Mathematics", "General Aptitude", "Core Subject"],
  "SSC CGL": ["General Intelligence", "English Language", "Quantitative Aptitude", "General Awareness"],
  "IBPS PO": ["Reasoning", "English Language", "Quantitative Aptitude", "General Awareness", "Computer Aptitude"],
  "NDA": ["Mathematics", "General Ability Test", "English", "General Knowledge"],
  "UGC NET": ["General Paper", "Subject Paper"],
  "SAT": ["Math", "Evidence-Based Reading", "Writing"],
  "GRE": ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
  "GMAT": ["Quantitative", "Verbal", "Integrated Reasoning", "Analytical Writing"],
  "CLAT": ["English", "Current Affairs", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques"],
  "State PSC": ["General Studies", "CSAT", "Optional Subject"],
  "CUET UG": ["General Test", "Domain Subject", "Language"],
  "USMLE": ["Anatomy", "Physiology", "Biochemistry", "Pharmacology", "Pathology", "Microbiology"],
  "CFA": ["Ethics", "Quantitative Methods", "Economics", "Financial Reporting", "Corporate Finance", "Equity Investments", "Fixed Income", "Derivatives", "Portfolio Management"],
  "MCAT": ["Biology", "Chemistry", "Physics", "Psychology", "Critical Analysis"],
};

type STQTab = "dashboard" | "syllabus" | "mining" | "tpi" | "patterns" | "training";

export default function STQEngineAdmin() {
  const [tab, setTab] = useState<STQTab>("dashboard");
  const [examType, setExamType] = useState("JEE Advanced");

  const tabs: { key: STQTab; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: BarChart3 },
    { key: "syllabus", label: "Syllabus Parser", icon: Layers },
    { key: "mining", label: "Question Mining", icon: Database },
    { key: "tpi", label: "TPI Scores", icon: Target },
    { key: "patterns", label: "Pattern Evolution", icon: TrendingUp },
    { key: "training", label: "Model Training", icon: RefreshCw },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">STQ Engine v9.0</h3>
          <p className="text-[10px] text-muted-foreground">Syllabus-to-Topic-to-Question ML Engine</p>
        </div>
        <select value={examType} onChange={e => setExamType(e.target.value)}
          className="ml-auto px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground">
          {["Government", "Entrance", "Global"].map(cat => (
            <optgroup key={cat} label={cat}>
              {STQ_EXAM_TYPES.filter(e => e.category === cat).map(e => (
                <option key={e.id} value={e.id}>{e.id}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}>
            <t.icon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "dashboard" && <DashboardView examType={examType} />}
      {tab === "syllabus" && <SyllabusParser examType={examType} />}
      {tab === "mining" && <QuestionMining examType={examType} />}
      {tab === "tpi" && <TPIScores examType={examType} />}
      {tab === "patterns" && <PatternEvolution examType={examType} />}
      {tab === "training" && <ModelTraining examType={examType} />}
    </div>
  );
}

// =============================================
// DASHBOARD
// =============================================
function DashboardView({ examType }: { examType: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["stq-dashboard", examType],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "get_dashboard", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <LoadingState />;

  const stats = data?.stats || {};
  const topTPI = (data?.tpi_scores || []).slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Taxonomy Items", value: stats.taxonomy_count, color: "text-blue-400" },
          { label: "Questions Mined", value: stats.questions_mined, color: "text-green-400" },
          { label: "TPI Topics", value: stats.topics_with_tpi, color: "text-orange-400" },
          { label: "High TPI (>85)", value: stats.high_tpi_count, color: "text-red-400" },
          { label: "Medium TPI", value: stats.medium_tpi_count, color: "text-yellow-400" },
          { label: "Pattern Alerts", value: stats.pattern_detections, color: "text-purple-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 bg-card border border-border">
            <p className={`text-lg font-bold ${s.color}`}>{s.value || 0}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Top TPI Topics */}
      {topTPI.length > 0 && (
        <Card title="Top Predicted Topics" icon={Target}>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {topTPI.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 text-xs">
                <TPIBadge score={t.tpi_score} />
                <span className="text-foreground flex-1 truncate font-medium">{t.topic}</span>
                <span className="text-muted-foreground">{t.subject}</span>
                <span className="text-[10px] text-muted-foreground">{t.confidence?.toFixed(0)}% conf</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Config Status */}
      {data?.config && (
        <Card title="Engine Status" icon={Zap}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Syllabus Parser", enabled: data.config.syllabus_parser_enabled },
              { label: "Question Mining", enabled: data.config.question_mining_enabled },
              { label: "TPI Engine", enabled: data.config.tpi_engine_enabled },
              { label: "Pattern Detection", enabled: data.config.pattern_detection_enabled },
              { label: "Memory Injection", enabled: data.config.memory_injection_enabled },
              { label: "Mock Integration", enabled: data.config.mock_integration_enabled },
              { label: "SureShot Link", enabled: data.config.sureshot_integration_enabled },
              { label: "Auto Retrain", enabled: data.config.auto_retrain_enabled },
            ].map(s => (
              <div key={s.label} className="flex justify-between p-2 rounded-lg bg-background/50">
                <span className="text-foreground">{s.label}</span>
                <span className={s.enabled ? "text-green-400" : "text-muted-foreground"}>{s.enabled ? "✅" : "❌"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// =============================================
// SYLLABUS PARSER (Full Featured)
// =============================================
function SyllabusParser({ examType }: { examType: string }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ subject: "", topic: "", subtopic: "", weightage_pct: "" });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const qc = useQueryClient();

  const availableSubjects = STQ_EXAM_SUBJECTS[examType] || [];

  const autoGenerate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "auto_generate_syllabus", exam_type: examType, subjects: selectedSubjects },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`🎉 Generated ${d.count} taxonomy items across ${Object.keys(d.subjects || {}).length} subjects`);
      qc.invalidateQueries({ queryKey: ["stq-taxonomy"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const parse = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Enter syllabus text");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "parse_syllabus", exam_type: examType, syllabus_text: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Parsed ${d.count} taxonomy items`); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); setText(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItems = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_taxonomy", ids },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Items deleted"); setSelectedIds(new Set()); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_taxonomy", exam_type: examType, delete_all: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success(`All ${examType} taxonomy cleared`); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async () => {
      if (!editingItem) throw new Error("No item selected");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: {
          action: "update_taxonomy", id: editingItem.id,
          updates: { subject: editForm.subject, topic: editForm.topic, subtopic: editForm.subtopic || null, weightage_pct: editForm.weightage_pct ? parseFloat(editForm.weightage_pct) : null },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Item updated"); setEditingItem(null); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ["stq-taxonomy", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("syllabus_taxonomies").select("*").eq("exam_type", examType).order("subject").order("topic");
      return data || [];
    },
  });

  const subjects = useMemo(() => {
    const s = new Set((taxonomy || []).map((t: any) => t.subject));
    return ["all", ...Array.from(s)];
  }, [taxonomy]);

  const filtered = useMemo(() => {
    let items = taxonomy || [];
    if (subjectFilter !== "all") items = items.filter((t: any) => t.subject === subjectFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((t: any) => t.topic?.toLowerCase().includes(q) || t.subtopic?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q));
    }
    return items;
  }, [taxonomy, subjectFilter, search]);

  const subjectStats = useMemo(() => {
    const stats: Record<string, { count: number; avgWeight: number }> = {};
    (taxonomy || []).forEach((t: any) => {
      if (!stats[t.subject]) stats[t.subject] = { count: 0, avgWeight: 0 };
      stats[t.subject].count++;
      if (t.weightage_pct) stats[t.subject].avgWeight += t.weightage_pct;
    });
    Object.values(stats).forEach(s => { if (s.count) s.avgWeight = Math.round(s.avgWeight / s.count * 10) / 10; });
    return stats;
  }, [taxonomy]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((t: any) => t.id)));
  };
  const startEdit = (item: any) => {
    setEditingItem(item);
    setEditForm({ subject: item.subject, topic: item.topic, subtopic: item.subtopic || "", weightage_pct: item.weightage_pct?.toString() || "" });
  };
  const exportCSV = () => {
    const rows = (taxonomy || []).map((t: any) => `${t.subject},${t.topic},${t.subtopic || ""},${t.hierarchy_level},${t.weightage_pct || ""},${t.source}`);
    const csv = "Subject,Topic,Subtopic,Level,Weightage%,Source\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${examType}_syllabus_taxonomy.csv`; a.click();
    URL.revokeObjectURL(url); toast.success("Exported CSV");
  };
  const toggleSubject = (s: string) => {
    setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
        <button onClick={() => setMode("auto")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${mode === "auto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Sparkles className="w-3.5 h-3.5" /> Auto Generate with AI
        </button>
        <button onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${mode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Upload className="w-3.5 h-3.5" /> Manual Input
        </button>
      </div>

      {/* Auto Generate */}
      {mode === "auto" && (
        <Card title="AI Auto Syllabus Generation" icon={Sparkles}>
          <p className="text-[10px] text-muted-foreground mb-3">
            AI will generate a complete, exhaustive syllabus with all topics, subtopics, weightages, and importance ratings for <span className="text-primary font-bold">{examType}</span>.
          </p>
          <div className="mb-3">
            <p className="text-[10px] font-medium text-foreground mb-1.5">Select Subjects (optional — leave empty for all):</p>
            <div className="flex flex-wrap gap-1.5">
              {(availableSubjects.length > 0 ? availableSubjects : ["General"]).map((s: string) => (
                <button key={s} onClick={() => toggleSubject(s)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                    selectedSubjects.includes(s) ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>
                  {selectedSubjects.includes(s) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => autoGenerate.mutate()} disabled={autoGenerate.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold disabled:opacity-50 shadow-lg">
            {autoGenerate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Full Syllabus with AI...</> : <><GraduationCap className="w-4 h-4" /> Generate Complete {examType} Syllabus</>}
          </button>
          {autoGenerate.isPending && (
            <div className="rounded-lg p-3 bg-primary/5 border border-primary/10 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-[10px] font-medium text-primary">AI is analyzing {examType} exam patterns...</p>
              </div>
              <div className="space-y-1 text-[9px] text-muted-foreground">
                <p>• Extracting complete subject hierarchy</p>
                <p>• Mapping all topics & subtopics</p>
                <p>• Calculating weightages from historical data</p>
                <p>• Assigning importance ratings</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Manual Input */}
      {mode === "manual" && (
        <Card title="Parse Syllabus Text" icon={Upload}>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={`Paste ${examType} syllabus text here...\n\nExample:\nPhysics:\n- Mechanics: Kinematics, Laws of Motion\n- Electrodynamics: Current Electricity, Magnetism`}
            className="w-full h-40 p-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground resize-none" />
          <button onClick={() => parse.mutate()} disabled={parse.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 mt-2">
            {parse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {parse.isPending ? "AI Parsing..." : "Parse with AI"}
          </button>
        </Card>
      )}

      {/* Subject Stats */}
      {Object.keys(subjectStats).length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(subjectStats).map(([subject, stats]) => (
            <div key={subject} className="rounded-xl p-2.5 bg-card border border-border text-center">
              <p className="text-sm font-bold text-foreground">{stats.count}</p>
              <p className="text-[10px] text-muted-foreground truncate">{subject}</p>
              {stats.avgWeight > 0 && <p className="text-[9px] text-primary">{stats.avgWeight}% avg wt</p>}
            </div>
          ))}
        </div>
      )}

      {/* Taxonomy List */}
      {taxonomy && taxonomy.length > 0 && (
        <Card title={`Taxonomy (${taxonomy.length} items)`} icon={Layers}>
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-1.5 flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-background border border-border">
              <Search className="w-3 h-3 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search topics..."
                className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
              {search && <button onClick={() => setSearch("")}><X className="w-3 h-3 text-muted-foreground" /></button>}
            </div>
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground">
              {subjects.map((s: string) => <option key={s} value={s}>{s === "all" ? "All Subjects" : s}</option>)}
            </select>
            <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[10px] hover:text-foreground">
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2 mb-2">
            <button onClick={toggleSelectAll} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
              {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
            </button>
            {selectedIds.size > 0 && (
              <button onClick={() => deleteItems.mutate([...selectedIds])} disabled={deleteItems.isPending}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-destructive/15 text-destructive font-medium">
                {deleteItems.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete Selected
              </button>
            )}
            <button onClick={() => { if (confirm(`Delete ALL ${examType} taxonomy items?`)) deleteAll.mutate(); }}
              disabled={deleteAll.isPending} className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-destructive/70 hover:text-destructive">
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          </div>

          {/* Items */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            <AnimatePresence>
              {filtered.map((t: any) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background/50 text-xs group">
                  <button onClick={() => toggleSelect(t.id)} className="shrink-0">
                    {selectedIds.has(t.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <span className={`shrink-0 w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                    t.hierarchy_level === 1 ? "bg-primary/15 text-primary" : t.hierarchy_level === 2 ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                  }`}>{t.hierarchy_level}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground truncate block">
                      <span className="font-medium">{t.subject}</span>
                      <span className="text-muted-foreground"> › </span>{t.topic}
                      {t.subtopic && <span className="text-muted-foreground"> › {t.subtopic}</span>}
                    </span>
                  </div>
                  {t.metadata?.importance && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-medium ${
                      t.metadata.importance === "critical" ? "bg-destructive/15 text-destructive" :
                      t.metadata.importance === "high" ? "bg-primary/15 text-primary" :
                      t.metadata.importance === "medium" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                    }`}>{t.metadata.importance}</span>
                  )}
                  {t.weightage_pct && <span className="shrink-0 text-[10px] text-muted-foreground">{t.weightage_pct}%</span>}
                  <span className="shrink-0 text-[8px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">{t.source?.replace("ai_", "AI ")}</span>
                  <button onClick={() => startEdit(t)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {filtered.length === 0 && search && <p className="text-[10px] text-muted-foreground text-center py-4">No items match "{search}"</p>}
        </Card>
      )}

      {/* Empty State */}
      {taxonomy?.length === 0 && !isLoading && (
        <div className="text-center py-8 space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No syllabus taxonomy yet</p>
          <p className="text-[10px] text-muted-foreground">Use AI Auto Generate or paste syllabus text to get started</p>
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setEditingItem(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-xl space-y-3"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">Edit Taxonomy Item</h4>
                <button onClick={() => setEditingItem(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              {([
                { label: "Subject", key: "subject" as const },
                { label: "Topic", key: "topic" as const },
                { label: "Subtopic", key: "subtopic" as const },
                { label: "Weightage %", key: "weightage_pct" as const },
              ]).map(f => (
                <div key={f.key}>
                  <label className="text-[10px] text-muted-foreground">{f.label}</label>
                  <input value={editForm[f.key]} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground mt-0.5" />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingItem(null)} className="flex-1 px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-xs">Cancel</button>
                <button onClick={() => updateItem.mutate()} disabled={updateItem.isPending}
                  className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                  {updateItem.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================
// QUESTION MINING (Full Featured)
// =============================================
function QuestionMining({ examType }: { examType: string }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [year, setYear] = useState(2024);
  const [text, setText] = useState("");
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2023, 2022, 2021, 2020]);
  const [autoProgress, setAutoProgress] = useState<{ running: boolean; current: string; done: number; total: number }>({ running: false, current: "", done: 0, total: 0 });
  const qc = useQueryClient();
  const availableSubjects = STQ_EXAM_SUBJECTS[examType] || [];
  const allYears = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

  // Auto mine with AI
  const autoMine = useMutation({
    mutationFn: async () => {
      if (!selectedYears.length) throw new Error("Select at least one year");
      setAutoProgress({ running: true, current: "Starting AI mining engine...", done: 0, total: selectedYears.length });

      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "auto_mine_questions", exam_type: examType, years: selectedYears, subjects: availableSubjects.length ? availableSubjects : undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      setAutoProgress(prev => ({ ...prev, running: false }));
      toast.success(`🎉 Mined ${d.total_mined} questions across ${selectedYears.length} years`);
      qc.invalidateQueries({ queryKey: ["stq-mining"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => { setAutoProgress(prev => ({ ...prev, running: false })); toast.error(e.message); },
  });

  // Manual mine
  const mine = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Enter question paper text");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "mine_questions", exam_type: examType, year, questions_text: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Mined ${d.count} questions`); qc.invalidateQueries({ queryKey: ["stq-mining"] }); setText(""); },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete year data
  const deleteYear = useMutation({
    mutationFn: async (y: number) => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_mining", exam_type: examType, year: y },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Year data deleted"); qc.invalidateQueries({ queryKey: ["stq-mining"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete all
  const deleteAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_mining", exam_type: examType, delete_all: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("All mining data cleared"); qc.invalidateQueries({ queryKey: ["stq-mining"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // Stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stq-mining", examType],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "get_mining_stats", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
  });

  const toggleYear = (y: number) => {
    setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]);
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
        <button onClick={() => setMode("auto")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${mode === "auto" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Sparkles className="w-3.5 h-3.5" /> Auto Mine with AI
        </button>
        <button onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${mode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Upload className="w-3.5 h-3.5" /> Manual Input
        </button>
      </div>

      {/* Auto Mine */}
      {mode === "auto" && (
        <Card title="AI Auto Question Mining" icon={Sparkles}>
          <p className="text-[10px] text-muted-foreground mb-3">
            AI will generate realistic exam question patterns for <span className="text-primary font-bold">{examType}</span> based on historical exam analysis, then classify and map them to your syllabus taxonomy.
          </p>

          {/* Year Selection */}
          <div className="mb-3">
            <p className="text-[10px] font-medium text-foreground mb-1.5">Select Years to Mine:</p>
            <div className="flex flex-wrap gap-1.5">
              {allYears.map(y => (
                <button key={y} onClick={() => toggleYear(y)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                    selectedYears.includes(y) ? "bg-primary/15 border-primary/30 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>
                  {selectedYears.includes(y) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setSelectedYears(allYears)} className="text-[10px] text-primary hover:underline">Select All</button>
            <button onClick={() => setSelectedYears([])} className="text-[10px] text-muted-foreground hover:underline">Clear</button>
            <button onClick={() => setSelectedYears([2024, 2023, 2022, 2021, 2020])} className="text-[10px] text-muted-foreground hover:underline">Last 5 Years</button>
          </div>

          {/* Subjects Info */}
          {availableSubjects.length > 0 && (
            <div className="rounded-lg p-2.5 bg-secondary/30 border border-border mb-3">
              <p className="text-[10px] text-muted-foreground">
                Mining subjects: <span className="text-foreground font-medium">{availableSubjects.join(", ")}</span>
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                ~{selectedYears.length * availableSubjects.length * 10} questions will be generated ({selectedYears.length} years × {availableSubjects.length} subjects × ~10 per batch)
              </p>
            </div>
          )}

          {/* Generate Button */}
          <button onClick={() => autoMine.mutate()} disabled={autoMine.isPending || !selectedYears.length}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold disabled:opacity-50 shadow-lg">
            {autoMine.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Mining Questions with AI...</> : <><Zap className="w-4 h-4" /> Mine {selectedYears.length} Years of {examType} Questions</>}
          </button>

          {/* Progress */}
          {autoMine.isPending && (
            <div className="rounded-lg p-3 bg-primary/5 border border-primary/10 mt-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-[10px] font-medium text-primary">AI is mining {examType} question patterns...</p>
              </div>
              <div className="space-y-1 text-[9px] text-muted-foreground">
                <p>• Analyzing historical exam patterns per subject</p>
                <p>• Classifying question types & difficulty</p>
                <p>• Mapping to syllabus taxonomy</p>
                <p>• Clustering semantic patterns</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: "5%" }}
                  animate={{ width: "85%" }} transition={{ duration: 30, ease: "linear" }} />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Manual Input */}
      {mode === "manual" && (
        <Card title="Mine from Question Paper" icon={Database}>
          <div className="flex gap-2 mb-2">
            <select value={year} onChange={e => setYear(+e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground">
              {allYears.map(y => <option key={y}>{y}</option>)}
            </select>
            <span className="text-xs text-muted-foreground self-center">Paper Year</span>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={`Paste ${examType} ${year} exam questions here...\n\nQ1. A particle of mass m is moving...\nQ2. The magnetic field at center of a circular loop...`}
            className="w-full h-40 p-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground resize-none" />
          <button onClick={() => mine.mutate()} disabled={mine.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 mt-2">
            {mine.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {mine.isPending ? "AI Mining..." : "Mine & Classify"}
          </button>
        </Card>
      )}

      {/* Stats Dashboard */}
      {!isLoading && stats && stats.total > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2.5 bg-card border border-border text-center">
              <p className="text-lg font-bold text-foreground">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total Mined</p>
            </div>
            <div className="rounded-xl p-2.5 bg-card border border-border text-center">
              <p className="text-lg font-bold text-foreground">{Object.keys(stats.by_year || {}).length}</p>
              <p className="text-[10px] text-muted-foreground">Years Covered</p>
            </div>
            <div className="rounded-xl p-2.5 bg-card border border-border text-center">
              <p className="text-lg font-bold text-foreground">{Object.keys(stats.by_subject || {}).length}</p>
              <p className="text-[10px] text-muted-foreground">Subjects</p>
            </div>
          </div>

          {/* By Year */}
          <Card title="Questions by Year" icon={BarChart3}>
            <div className="space-y-1.5">
              {Object.entries(stats.by_year || {}).sort(([a], [b]) => +b - +a).map(([y, count]: [string, any]) => (
                <div key={y} className="flex items-center gap-2 group">
                  <span className="text-xs font-medium text-foreground w-10">{y}</span>
                  <div className="flex-1 h-5 rounded-full bg-secondary overflow-hidden">
                    <motion.div className="h-full rounded-full bg-primary/60" initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (count / Math.max(...Object.values(stats.by_year as Record<string, number>))) * 100)}%` }}
                      transition={{ duration: 0.5 }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{count}</span>
                  <button onClick={() => { if (confirm(`Delete all ${examType} ${y} mining data?`)) deleteYear.mutate(+y); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3 text-destructive/50 hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* By Subject */}
          <Card title="Questions by Subject" icon={Layers}>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.by_subject || {}).map(([subject, count]: [string, any]) => (
                <div key={subject} className="rounded-lg p-2.5 bg-background/50">
                  <p className="text-xs font-bold text-foreground">{count}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{subject}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* By Difficulty */}
          <Card title="Difficulty Distribution" icon={Target}>
            <div className="flex gap-2">
              {Object.entries(stats.by_difficulty || {}).map(([diff, count]: [string, any]) => {
                const colors: Record<string, string> = { easy: "bg-green-500/15 text-green-400", medium: "bg-yellow-500/15 text-yellow-400", hard: "bg-red-500/15 text-red-400", very_hard: "bg-purple-500/15 text-purple-400" };
                return (
                  <div key={diff} className={`flex-1 rounded-lg p-2 text-center ${colors[diff] || "bg-secondary text-muted-foreground"}`}>
                    <p className="text-sm font-bold">{count}</p>
                    <p className="text-[9px] capitalize">{diff.replace("_", " ")}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Topics */}
          {stats.top_topics?.length > 0 && (
            <Card title="Most Frequent Topics" icon={TrendingUp}>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {stats.top_topics.map((t: any, i: number) => (
                  <div key={t.topic} className="flex items-center gap-2 p-1.5 rounded-lg bg-background/50 text-xs">
                    <span className="w-5 h-5 rounded flex items-center justify-center bg-primary/10 text-primary text-[9px] font-bold">{i + 1}</span>
                    <span className="flex-1 text-foreground truncate">{t.topic}</span>
                    <span className="text-muted-foreground">{t.count}×</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Clear All */}
          <button onClick={() => { if (confirm(`Delete ALL ${examType} mining data?`)) deleteAll.mutate(); }}
            disabled={deleteAll.isPending}
            className="flex items-center justify-center gap-1 w-full px-3 py-2 rounded-lg text-[10px] text-destructive/70 hover:text-destructive border border-destructive/10 hover:border-destructive/30 transition-colors">
            <Trash2 className="w-3 h-3" /> Clear All Mining Data
          </button>
        </>
      )}

      {/* Empty State */}
      {!isLoading && (!stats || stats.total === 0) && (
        <div className="text-center py-8 space-y-2">
          <Database className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No questions mined yet</p>
          <p className="text-[10px] text-muted-foreground">Use AI Auto Mine or paste question papers to populate</p>
        </div>
      )}
    </div>
  );
}

// =============================================
// TPI SCORES
// =============================================
function TPIScores({ examType }: { examType: string }) {
  const qc = useQueryClient();

  const { data: tpiScores, isLoading } = useQuery({
    queryKey: ["stq-tpi", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("topic_probability_index")
        .select("*").eq("exam_type", examType).order("tpi_score", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const computeTPI = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "compute_tpi", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Computed TPI for ${d.topics_computed} topics`);
      qc.invalidateQueries({ queryKey: ["stq-tpi"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground">Topic Probability Index</h4>
        <button onClick={() => computeTPI.mutate()} disabled={computeTPI.isPending}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-medium disabled:opacity-50">
          {computeTPI.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Recompute TPI
        </button>
      </div>

      {isLoading ? <LoadingState /> : tpiScores?.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No TPI data yet. Mine questions first, then compute TPI.</p>
      ) : (
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
          {tpiScores?.map((t: any) => (
            <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-xl p-3 bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TPIBadge score={t.tpi_score} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{t.topic}</p>
                  <p className="text-[10px] text-muted-foreground">{t.subject}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{t.confidence?.toFixed(0)}% conf</span>
              </div>
              {/* Score Breakdown */}
              <div className="grid grid-cols-5 gap-1">
                {[
                  { label: "Freq", value: t.frequency_score },
                  { label: "Recent", value: t.recency_score },
                  { label: "Trend", value: t.trend_momentum_score },
                  { label: "Volatile", value: t.volatility_score },
                  { label: "Diff", value: t.difficulty_score },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="h-1 rounded-full bg-secondary overflow-hidden mb-0.5">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${s.value || 0}%` }} />
                    </div>
                    <p className="text-[8px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {t.appearance_years?.length > 0 && (
                <p className="text-[9px] text-muted-foreground mt-1">
                  Years: {t.appearance_years.join(", ")} · {t.data_points_used} data points
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// PATTERN EVOLUTION
// =============================================
function PatternEvolution({ examType }: { examType: string }) {
  const qc = useQueryClient();

  const { data: patterns, isLoading } = useQuery({
    queryKey: ["stq-patterns", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("pattern_evolution_logs")
        .select("*").eq("exam_type", examType).order("detected_at", { ascending: false }).limit(30);
      return data || [];
    },
  });

  const detectPatterns = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "detect_patterns", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Detected ${d.detections_count} patterns`);
      qc.invalidateQueries({ queryKey: ["stq-patterns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const severityColor: Record<string, string> = {
    high: "bg-red-500/15 text-red-400",
    moderate: "bg-yellow-500/15 text-yellow-400",
    low: "bg-green-500/15 text-green-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground">Pattern Evolution Detection</h4>
        <button onClick={() => detectPatterns.mutate()} disabled={detectPatterns.isPending}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-medium disabled:opacity-50">
          {detectPatterns.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
          Run Detection
        </button>
      </div>

      {isLoading ? <LoadingState /> : patterns?.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No patterns detected yet. Mine questions and run detection.</p>
      ) : (
        <div className="space-y-2">
          {patterns?.map((p: any) => (
            <div key={p.id} className="rounded-xl p-3 bg-card border border-border">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityColor[p.severity] || severityColor.moderate}`}>
                  {p.severity}
                </span>
                <span className="text-[10px] text-muted-foreground">{p.detection_type?.replace(/_/g, " ")}</span>
              </div>
              <p className="text-xs text-foreground">{p.description}</p>
              {p.recommendation && <p className="text-[10px] text-primary mt-1">💡 {p.recommendation}</p>}
              {p.affected_topics?.length > 0 && (
                <p className="text-[9px] text-muted-foreground mt-1">Topics: {p.affected_topics.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// MODEL TRAINING
// =============================================
function ModelTraining({ examType }: { examType: string }) {
  const qc = useQueryClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["stq-training-logs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("stq_training_logs")
        .select("*").order("created_at", { ascending: false }).limit(15);
      return data || [];
    },
  });

  const retrain = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "retrain", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Model ${d.model_version} trained on ${d.data_points} data points (${d.duration_ms}ms)`);
      qc.invalidateQueries({ queryKey: ["stq-training-logs"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground">Model Training</h4>
        <button onClick={() => retrain.mutate()} disabled={retrain.isPending}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 text-[11px] font-medium disabled:opacity-50">
          {retrain.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {retrain.isPending ? "Training..." : `Retrain (${examType})`}
        </button>
      </div>

      {isLoading ? <LoadingState /> : logs?.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No training history yet.</p>
      ) : (
        <div className="space-y-2">
          {logs?.map((l: any) => (
            <div key={l.id} className="rounded-xl p-3 bg-card border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground">{l.model_version}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  l.status === "completed" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                }`}>{l.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                <span>{l.data_points_processed} pts</span>
                <span>{l.duration_ms}ms</span>
                <span>{l.exam_types_trained?.join(", ")}</span>
              </div>
              {l.accuracy_before != null && l.accuracy_after != null && (
                <p className="text-[10px] mt-1">
                  Confidence: <span className="text-muted-foreground">{l.accuracy_before?.toFixed(1)}%</span>
                  {" → "}
                  <span className="text-primary font-medium">{l.accuracy_after?.toFixed(1)}%</span>
                </p>
              )}
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {new Date(l.created_at).toLocaleString()} • {l.triggered_by}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// SHARED COMPONENTS
// =============================================
function Card({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 space-y-3 bg-card border border-border">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <h4 className="text-xs font-bold text-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function TPIBadge({ score }: { score: number }) {
  const color = score >= 85 ? "bg-red-500/20 text-red-400" : score >= 60 ? "bg-orange-500/20 text-orange-400" : score >= 40 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${color}`}>{score?.toFixed(0)}</span>;
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );
}
