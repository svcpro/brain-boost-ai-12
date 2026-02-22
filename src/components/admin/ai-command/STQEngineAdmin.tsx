import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Upload, RefreshCw, TrendingUp, Database, Zap, BarChart3, AlertTriangle, Loader2, Target, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type STQTab = "dashboard" | "syllabus" | "mining" | "tpi" | "patterns" | "training";

export default function STQEngineAdmin() {
  const [tab, setTab] = useState<STQTab>("dashboard");
  const [examType, setExamType] = useState("JEE");

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
          <option>JEE</option><option>NEET</option><option>UPSC</option><option>general</option>
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
// SYLLABUS PARSER
// =============================================
function SyllabusParser({ examType }: { examType: string }) {
  const [text, setText] = useState("");
  const qc = useQueryClient();

  const parse = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Enter syllabus text");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "parse_syllabus", exam_type: examType, syllabus_text: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Parsed ${d.count} taxonomy items`); qc.invalidateQueries({ queryKey: ["stq-dashboard"] }); setText(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: taxonomy } = useQuery({
    queryKey: ["stq-taxonomy", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("syllabus_taxonomies").select("*").eq("exam_type", examType).order("subject").limit(100);
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <Card title="Parse Syllabus" icon={Upload}>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder={`Paste ${examType} syllabus text here...\n\nExample:\nPhysics:\n- Mechanics: Kinematics, Laws of Motion, Work Energy Power\n- Electrodynamics: Current Electricity, Magnetism`}
          className="w-full h-40 p-3 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground resize-none" />
        <button onClick={() => parse.mutate()} disabled={parse.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 mt-2">
          {parse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          {parse.isPending ? "AI Parsing..." : "Parse with AI"}
        </button>
      </Card>

      {taxonomy && taxonomy.length > 0 && (
        <Card title={`Taxonomy (${taxonomy.length})`} icon={Layers}>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {taxonomy.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 text-xs">
                <span className="text-primary font-bold w-6 text-center">{t.hierarchy_level}</span>
                <span className="text-foreground flex-1 truncate">{t.subject} › {t.topic}{t.subtopic ? ` › ${t.subtopic}` : ""}</span>
                {t.weightage_pct && <span className="text-muted-foreground">{t.weightage_pct}%</span>}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t.source}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// =============================================
// QUESTION MINING
// =============================================
function QuestionMining({ examType }: { examType: string }) {
  const [year, setYear] = useState(2024);
  const [text, setText] = useState("");
  const qc = useQueryClient();

  const mine = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Enter question paper text");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "mine_questions", exam_type: examType, year, questions_text: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Mined ${d.count} questions`); qc.invalidateQueries({ queryKey: ["stq-dashboard"] }); setText(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: minedCount } = useQuery({
    queryKey: ["stq-mining-count", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("question_mining_results").select("year, subject").eq("exam_type", examType);
      const byYear: Record<number, number> = {};
      (data || []).forEach((q: any) => { byYear[q.year] = (byYear[q.year] || 0) + 1; });
      return byYear;
    },
  });

  return (
    <div className="space-y-4">
      <Card title="Mine Questions" icon={Database}>
        <div className="flex gap-2 mb-2">
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground">
            {[2024, 2023, 2022, 2021, 2020, 2019].map(y => <option key={y}>{y}</option>)}
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

      {minedCount && Object.keys(minedCount).length > 0 && (
        <Card title="Mined Data" icon={BarChart3}>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(minedCount).sort(([a], [b]) => +b - +a).map(([y, count]) => (
              <div key={y} className="rounded-lg p-2 bg-background/50 text-center">
                <p className="text-sm font-bold text-foreground">{count as number}</p>
                <p className="text-[10px] text-muted-foreground">{y}</p>
              </div>
            ))}
          </div>
        </Card>
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
