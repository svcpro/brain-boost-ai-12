import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Database, TrendingUp, TrendingDown, Settings, BarChart3,
  Loader2, RefreshCw, Search, Upload, Trash2, Check, X, Eye, Lock,
  ThumbsUp, ThumbsDown, Zap, Activity, Target, AlertTriangle,
  ChevronDown, ChevronRight, BookOpen, Sparkles, Minus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

type Tab = "questions" | "predictions" | "trends" | "model" | "modes" | "weights";

interface AdminConfig {
  weight_trend_momentum: number;
  weight_time_series: number;
  weight_historical_frequency: number;
  weight_difficulty_alignment: number;
  weight_semantic_similarity: number;
  weight_examiner_behavior: number;
  prediction_min_score: number;
  prediction_max_score: number;
  display_threshold: number;
  show_research_button: boolean;
  calm_mode_enabled: boolean;
  exam_mode_enabled: boolean;
  rapid_mode_enabled: boolean;
  model_version: string;
  last_retrain_at: string | null;
  retrain_interval_days: number;
  dataset_size: number;
  prediction_accuracy: number;
  updated_at: string;
}

interface QuestionBankItem {
  id: string;
  question: string;
  exam_type: string;
  subject: string;
  topic: string;
  difficulty: string;
  year: number;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
}

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "questions", label: "Question Bank", icon: Database },
  { key: "predictions", label: "AI Predictions", icon: Brain },
  { key: "trends", label: "Trend Research", icon: TrendingUp },
  { key: "model", label: "ML Model", icon: Activity },
  { key: "modes", label: "Mode Config", icon: Settings },
  { key: "weights", label: "Weight Control", icon: Zap },
];

const SureShotAdminPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("questions");
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Question Bank state
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qSearch, setQSearch] = useState("");
  const [qFilter, setQFilter] = useState({ exam: "", subject: "", year: "", difficulty: "" });
  const [qTotal, setQTotal] = useState(0);
  const [qPage, setQPage] = useState(0);

  // Trend data
  const [trendData, setTrendData] = useState<any[]>([]);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Fetch config
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sureshot_admin_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (!error && data) setConfig(data as any);
    setLoading(false);
  }, []);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setQLoading(true);
    let query = supabase
      .from("question_bank")
      .select("id, question, exam_type, subject, topic, difficulty, year, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(qPage * 20, (qPage + 1) * 20 - 1);

    if (qFilter.exam) query = query.eq("exam_type", qFilter.exam);
    if (qFilter.subject) query = query.eq("subject", qFilter.subject);
    if (qFilter.year) query = query.eq("year", parseInt(qFilter.year));
    if (qFilter.difficulty) query = query.eq("difficulty", qFilter.difficulty);
    if (qSearch) query = query.ilike("question", `%${qSearch}%`);

    const { data, count, error } = await query;
    if (!error) {
      setQuestions((data || []) as any);
      setQTotal(count || 0);
    }
    setQLoading(false);
  }, [qPage, qFilter, qSearch]);

  // Fetch trend data from question_bank aggregation
  const fetchTrends = useCallback(async () => {
    const { data } = await supabase
      .from("question_bank")
      .select("topic, subject, year, difficulty, exam_type")
      .order("year", { ascending: false })
      .limit(1000);

    if (!data) return;

    // Aggregate by topic
    const topicMap: Record<string, { count: number; years: Set<number>; yearCounts: Record<number, number>; difficulties: string[] }> = {};
    for (const q of data) {
      const key = q.topic || q.subject || "General";
      if (!topicMap[key]) topicMap[key] = { count: 0, years: new Set(), yearCounts: {}, difficulties: [] };
      topicMap[key].count++;
      if (q.year) { topicMap[key].years.add(q.year); topicMap[key].yearCounts[q.year] = (topicMap[key].yearCounts[q.year] || 0) + 1; }
      if (q.difficulty) topicMap[key].difficulties.push(q.difficulty);
    }

    // Compute trends
    const allYears = [...new Set(data.map(q => q.year).filter(Boolean))].sort() as number[];
    const trends = Object.entries(topicMap).map(([topic, info]) => {
      const yearCounts = allYears.map(y => info.yearCounts[y] || 0);
      const n = yearCounts.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) { sumX += i; sumY += yearCounts[i]; sumXY += i * yearCounts[i]; sumXX += i * i; }
      const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;
      const direction = slope > 0.3 ? "rising" : slope < -0.3 ? "declining" : "stable";
      const hardRatio = info.difficulties.filter(d => d === "hard").length / Math.max(info.difficulties.length, 1);
      return {
        topic, count: info.count, years: info.years.size, direction, slope: Math.round(slope * 100) / 100,
        yearCounts: info.yearCounts, hardRatio: Math.round(hardRatio * 100),
        momentum: Math.round(Math.min(100, Math.abs(slope) * 30 + (info.years.size / Math.max(allYears.length, 1)) * 70)),
      };
    }).sort((a, b) => b.count - a.count);

    setTrendData(trends);
  }, []);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("sureshot_prediction_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setAuditLogs(data as any);
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => {
    if (tab === "questions") fetchQuestions();
    if (tab === "trends") fetchTrends();
    if (tab === "model") fetchLogs();
  }, [tab, fetchQuestions, fetchTrends, fetchLogs]);

  // Save config
  const saveConfig = async (updates: Partial<AdminConfig>) => {
    if (!config || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("sureshot_admin_config")
      .update({ ...updates, updated_by: user.id })
      .eq("id", "default");
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      setConfig({ ...config, ...updates } as any);
      toast({ title: "Config saved ✅" });
      // Log the action
      await supabase.from("sureshot_prediction_logs").insert({
        admin_id: user.id,
        action: "config_update",
        details: updates,
      });
    }
    setSaving(false);
  };

  // Delete question
  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from("question_bank").delete().eq("id", id);
    if (!error) {
      setQuestions(prev => prev.filter(q => q.id !== id));
      setQTotal(prev => prev - 1);
      toast({ title: "Question deleted" });
    }
  };

  // Log action
  const logAction = async (action: string, details?: any) => {
    if (!user) return;
    await supabase.from("sureshot_prediction_logs").insert({
      admin_id: user.id, action, details,
    });
    fetchLogs();
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            SureShot Ultra AI Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ML Research Engine Control Panel — Model {config.model_version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
            Accuracy: {config.prediction_accuracy || 0}%
          </span>
          <span className="text-[10px] px-2 py-1 rounded-full bg-success/15 text-success font-bold">
            Dataset: {config.dataset_size.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-secondary/60 border border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {tab === "questions" && (
            <QuestionBankTab
              questions={questions}
              loading={qLoading}
              search={qSearch}
              setSearch={setQSearch}
              filter={qFilter}
              setFilter={setQFilter}
              total={qTotal}
              page={qPage}
              setPage={setQPage}
              onDelete={deleteQuestion}
              onRefresh={fetchQuestions}
            />
          )}
          {tab === "predictions" && <PredictionControlTab config={config} onSave={saveConfig} onLog={logAction} />}
          {tab === "trends" && <TrendResearchTab data={trendData} loading={!trendData.length} />}
          {tab === "model" && <MLModelTab config={config} onSave={saveConfig} logs={auditLogs} onLog={logAction} />}
          {tab === "modes" && <ModeConfigTab config={config} onSave={saveConfig} />}
          {tab === "weights" && <WeightControlTab config={config} onSave={saveConfig} saving={saving} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Question Bank Management
// ═══════════════════════════════════════════════════════════════
const QuestionBankTab = ({
  questions, loading, search, setSearch, filter, setFilter, total, page, setPage, onDelete, onRefresh,
}: {
  questions: QuestionBankItem[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  filter: any;
  setFilter: (f: any) => void;
  total: number;
  page: number;
  setPage: (p: number) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Questions", value: total.toLocaleString(), icon: Database, color: "primary" },
          { label: "Exams", value: [...new Set(questions.map(q => q.exam_type))].length, icon: BookOpen, color: "accent" },
          { label: "Subjects", value: [...new Set(questions.map(q => q.subject))].length, icon: Sparkles, color: "success" },
          { label: "Years Covered", value: [...new Set(questions.map(q => q.year))].length, icon: BarChart3, color: "warning" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-card border border-border/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border/50 rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <select value={filter.exam} onChange={e => setFilter({ ...filter, exam: e.target.value })} className="bg-card border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground">
          <option value="">All Exams</option>
          {["UPSC", "SSC", "Banking", "JEE", "NEET", "State PSC"].map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filter.difficulty} onChange={e => setFilter({ ...filter, difficulty: e.target.value })} className="bg-card border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground">
          <option value="">All Difficulty</option>
          {["easy", "medium", "hard"].map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filter.year} onChange={e => setFilter({ ...filter, year: e.target.value })} className="bg-card border border-border/50 rounded-xl px-3 py-2.5 text-sm text-foreground">
          <option value="">All Years</option>
          {[2024, 2023, 2022, 2021, 2020].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={onRefresh} className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className="rounded-xl bg-card border border-border/50 p-3 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{q.question}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{q.exam_type}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{q.subject}</span>
                    {q.topic && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{q.topic}</span>}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">{q.year}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      q.difficulty === "hard" ? "bg-destructive/10 text-destructive" :
                      q.difficulty === "medium" ? "bg-warning/10 text-warning" :
                      "bg-success/10 text-success"
                    }`}>{q.difficulty}</span>
                  </div>
                </div>
                <button onClick={() => onDelete(q.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {questions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No questions found</div>
          )}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">Showing {page * 20 + 1}–{Math.min((page + 1) * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg bg-secondary text-sm text-foreground disabled:opacity-30">Prev</button>
            <button disabled={(page + 1) * 20 >= total} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg bg-secondary text-sm text-foreground disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SECTION 2: AI Prediction Control Panel
// ═══════════════════════════════════════════════════════════════
const PredictionControlTab = ({ config, onSave, onLog }: { config: AdminConfig; onSave: (u: Partial<AdminConfig>) => void; onLog: (a: string, d?: any) => void }) => {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Simulate loading predictions from last generated session
  useEffect(() => {
    // Generate sample predictions for display
    const samples = [
      { topic: "Indian Polity", score: 82, trend: "rising", momentum: 78, confidence: "Strong", volatility: 25, stability: 85, status: "approved" },
      { topic: "Modern History", score: 76, trend: "stable", momentum: 55, confidence: "Moderate", volatility: 30, stability: 72, status: "pending" },
      { topic: "Economic Survey", score: 71, trend: "rising", momentum: 68, confidence: "Moderate", volatility: 40, stability: 60, status: "pending" },
      { topic: "Environment", score: 68, trend: "comeback", momentum: 62, confidence: "Moderate", volatility: 45, stability: 55, status: "pending" },
      { topic: "Art & Culture", score: 63, trend: "declining", momentum: 35, confidence: "Fair", volatility: 50, stability: 45, status: "rejected" },
      { topic: "Science & Tech", score: 79, trend: "rising", momentum: 72, confidence: "Strong", volatility: 20, stability: 80, status: "approved" },
    ];
    setPredictions(samples);
  }, []);

  const updateStatus = (index: number, status: string) => {
    setPredictions(prev => prev.map((p, i) => i === index ? { ...p, status } : p));
    onLog(status === "approved" ? "approve" : "reject", { topic: predictions[index]?.topic });
  };

  const trendIcon = (dir: string) => {
    if (dir === "rising") return <TrendingUp className="w-3.5 h-3.5 text-success" />;
    if (dir === "declining") return <TrendingDown className="w-3.5 h-3.5 text-destructive" />;
    if (dir === "comeback") return <Zap className="w-3.5 h-3.5 text-warning" />;
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Prediction Queue</h3>
        <div className="flex gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full bg-success/15 text-success font-bold">
            {predictions.filter(p => p.status === "approved").length} Approved
          </span>
          <span className="text-[10px] px-2 py-1 rounded-full bg-warning/15 text-warning font-bold">
            {predictions.filter(p => p.status === "pending").length} Pending
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {predictions.map((p, i) => (
          <div key={i} className="rounded-xl bg-card border border-border/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {trendIcon(p.trend)}
                <span className="text-sm font-bold text-foreground">{p.topic}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  p.status === "approved" ? "bg-success/15 text-success" :
                  p.status === "rejected" ? "bg-destructive/15 text-destructive" :
                  "bg-warning/15 text-warning"
                }`}>{p.status}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => updateStatus(i, "approved")} className="p-1.5 rounded-lg hover:bg-success/10 text-success/60 hover:text-success transition-colors">
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => updateStatus(i, "rejected")} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors">
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onLog("lock", { topic: p.topic })} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors">
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: "Prediction", value: `${p.score}%`, color: p.score >= 75 ? "text-success" : p.score >= 65 ? "text-primary" : "text-warning" },
                { label: "Momentum", value: p.momentum, color: "text-primary" },
                { label: "Confidence", value: p.confidence, color: p.confidence === "Strong" ? "text-success" : "text-warning" },
                { label: "Volatility", value: p.volatility, color: p.volatility > 40 ? "text-destructive" : "text-muted-foreground" },
                { label: "Stability", value: p.stability, color: "text-muted-foreground" },
                { label: "Trend", value: p.trend, color: p.trend === "rising" ? "text-success" : p.trend === "declining" ? "text-destructive" : "text-foreground" },
              ].map((m, j) => (
                <div key={j} className="text-center">
                  <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-[9px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Trend Research Dashboard
// ═══════════════════════════════════════════════════════════════
const TrendResearchTab = ({ data, loading }: { data: any[]; loading: boolean }) => {
  const rising = data.filter(d => d.direction === "rising");
  const declining = data.filter(d => d.direction === "declining");
  const stable = data.filter(d => d.direction === "stable");

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-success/5 border border-success/20 p-4 text-center">
          <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-success">{rising.length}</p>
          <p className="text-[10px] text-muted-foreground">Rising Topics</p>
        </div>
        <div className="rounded-xl bg-secondary border border-border/50 p-4 text-center">
          <Minus className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stable.length}</p>
          <p className="text-[10px] text-muted-foreground">Stable Topics</p>
        </div>
        <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-center">
          <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-destructive">{declining.length}</p>
          <p className="text-[10px] text-muted-foreground">Declining Topics</p>
        </div>
      </div>

      {/* Rising Topics */}
      {rising.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-success mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Rising Topics
          </h4>
          <div className="space-y-2">
            {rising.slice(0, 10).map((t, i) => (
              <TrendRow key={i} data={t} />
            ))}
          </div>
        </div>
      )}

      {/* Declining Topics */}
      {declining.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-destructive mb-2 flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4" /> Declining Topics
          </h4>
          <div className="space-y-2">
            {declining.slice(0, 10).map((t, i) => (
              <TrendRow key={i} data={t} />
            ))}
          </div>
        </div>
      )}

      {/* Stable Topics */}
      {stable.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Minus className="w-4 h-4" /> Stable Topics
          </h4>
          <div className="space-y-2">
            {stable.slice(0, 10).map((t, i) => (
              <TrendRow key={i} data={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TrendRow = ({ data }: { data: any }) => (
  <div className="rounded-xl bg-card border border-border/50 p-3 flex items-center gap-3">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground truncate">{data.topic}</p>
      <p className="text-[10px] text-muted-foreground">{data.count} occurrences · {data.years} years · Slope: {data.slope}</p>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <div className="text-center">
        <p className="text-sm font-bold text-primary">{data.momentum}</p>
        <p className="text-[8px] text-muted-foreground">Momentum</p>
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-foreground">{data.hardRatio}%</p>
        <p className="text-[8px] text-muted-foreground">Hard %</p>
      </div>
      <div className="w-20">
        <Progress value={data.momentum} className="h-1.5" />
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// SECTION 4: ML Model Management
// ═══════════════════════════════════════════════════════════════
const MLModelTab = ({ config, onSave, logs, onLog }: { config: AdminConfig; onSave: (u: Partial<AdminConfig>) => void; logs: AuditLog[]; onLog: (a: string, d?: any) => void }) => {
  const [retraining, setRetraining] = useState(false);

  const handleRetrain = async () => {
    setRetraining(true);
    onLog("retrain", { model_version: config.model_version });
    // Simulate retrain
    await new Promise(r => setTimeout(r, 3000));
    onSave({
      last_retrain_at: new Date().toISOString(),
      model_version: `v${(parseFloat(config.model_version.replace("v", "")) + 0.1).toFixed(1)}`,
    });
    setRetraining(false);
  };

  return (
    <div className="space-y-6">
      {/* Model Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-card border border-border/50 p-4">
          <p className="text-[10px] text-muted-foreground mb-1">Model Version</p>
          <p className="text-xl font-bold text-primary">{config.model_version}</p>
        </div>
        <div className="rounded-xl bg-card border border-border/50 p-4">
          <p className="text-[10px] text-muted-foreground mb-1">Dataset Size</p>
          <p className="text-xl font-bold text-foreground">{config.dataset_size.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-card border border-border/50 p-4">
          <p className="text-[10px] text-muted-foreground mb-1">Last Trained</p>
          <p className="text-sm font-bold text-foreground">
            {config.last_retrain_at ? new Date(config.last_retrain_at).toLocaleDateString() : "Never"}
          </p>
        </div>
        <div className="rounded-xl bg-card border border-border/50 p-4">
          <p className="text-[10px] text-muted-foreground mb-1">Accuracy</p>
          <p className="text-xl font-bold text-success">{config.prediction_accuracy}%</p>
        </div>
      </div>

      {/* Retrain Button */}
      <button
        onClick={handleRetrain}
        disabled={retraining}
        className="w-full rounded-xl bg-primary/10 border border-primary/30 p-4 text-left hover:bg-primary/15 transition-colors disabled:opacity-60 flex items-center gap-3"
      >
        {retraining ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <RefreshCw className="w-5 h-5 text-primary" />
        )}
        <div>
          <p className="text-sm font-bold text-primary">
            {retraining ? "Retraining Model..." : "Trigger Model Retrain"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Retrain interval: every {config.retrain_interval_days} days
          </p>
        </div>
      </button>

      {/* Audit Log */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-3">Action History</h4>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No actions logged yet</p>}
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 px-3 py-2">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                log.action === "approve" ? "bg-success/15 text-success" :
                log.action === "reject" ? "bg-destructive/15 text-destructive" :
                log.action === "retrain" ? "bg-primary/15 text-primary" :
                "bg-secondary text-muted-foreground"
              }`}>{log.action}</span>
              <span className="text-[10px] text-muted-foreground flex-1 truncate">
                {log.details ? JSON.stringify(log.details).slice(0, 60) : "—"}
              </span>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SECTION 5: Mode Config
// ═══════════════════════════════════════════════════════════════
const ModeConfigTab = ({ config, onSave }: { config: AdminConfig; onSave: (u: Partial<AdminConfig>) => void }) => {
  const modes = [
    { key: "calm_mode_enabled" as const, label: "Calm Mode", desc: "No pressure practice with full explanations", icon: "💆" },
    { key: "exam_mode_enabled" as const, label: "Simulation Mode", desc: "Timed exam simulation with auto-advance", icon: "⏱️" },
    { key: "rapid_mode_enabled" as const, label: "Rapid Revision", desc: "Fast-paced review with quick answers", icon: "⚡" },
  ];

  return (
    <div className="space-y-6">
      {/* Practice Modes */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-3">Practice Modes</h4>
        <div className="space-y-2">
          {modes.map(m => (
            <div key={m.key} className="rounded-xl bg-card border border-border/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{m.icon}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                </div>
              </div>
              <button
                onClick={() => onSave({ [m.key]: !config[m.key] })}
                className={`w-12 h-7 rounded-full transition-colors relative ${config[m.key] ? "bg-primary" : "bg-secondary"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${config[m.key] ? "left-6" : "left-1"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Display Config */}
      <div>
        <h4 className="text-sm font-bold text-foreground mb-3">Display Settings</h4>
        <div className="space-y-3">
          <div className="rounded-xl bg-card border border-border/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Prediction Range</p>
              <span className="text-xs text-primary font-bold">{config.prediction_min_score}% — {config.prediction_max_score}%</span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Min</label>
                <input type="number" value={config.prediction_min_score} min={40} max={70}
                  onChange={e => onSave({ prediction_min_score: parseInt(e.target.value) || 55 })}
                  className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Max</label>
                <input type="number" value={config.prediction_max_score} min={70} max={95}
                  onChange={e => onSave({ prediction_max_score: parseInt(e.target.value) || 85 })}
                  className="w-full bg-secondary border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-card border border-border/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Show "View Research" Button</p>
              <p className="text-[10px] text-muted-foreground">Transparency view for ML score breakdown</p>
            </div>
            <button
              onClick={() => onSave({ show_research_button: !config.show_research_button })}
              className={`w-12 h-7 rounded-full transition-colors relative ${config.show_research_button ? "bg-primary" : "bg-secondary"}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-1 transition-all ${config.show_research_button ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <div className="rounded-xl bg-card border border-border/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Display Threshold</p>
              <span className="text-xs text-primary font-bold">{config.display_threshold}%</span>
            </div>
            <input type="range" min={30} max={80} value={config.display_threshold}
              onChange={e => onSave({ display_threshold: parseInt(e.target.value) })}
              className="w-full accent-primary" />
            <p className="text-[10px] text-muted-foreground mt-1">Only show predictions above this score</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SECTION 6: AI Intelligence Weight Controls
// ═══════════════════════════════════════════════════════════════
const WeightControlTab = ({ config, onSave, saving }: { config: AdminConfig; onSave: (u: Partial<AdminConfig>) => void; saving: boolean }) => {
  const [weights, setWeights] = useState({
    trend: config.weight_trend_momentum * 100,
    timeSeries: config.weight_time_series * 100,
    frequency: config.weight_historical_frequency * 100,
    difficulty: config.weight_difficulty_alignment * 100,
    semantic: config.weight_semantic_similarity * 100,
    examiner: config.weight_examiner_behavior * 100,
  });

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const isValid = Math.abs(total - 100) < 1;

  const updateWeight = (key: string, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const saveWeights = () => {
    if (!isValid) return;
    onSave({
      weight_trend_momentum: weights.trend / 100,
      weight_time_series: weights.timeSeries / 100,
      weight_historical_frequency: weights.frequency / 100,
      weight_difficulty_alignment: weights.difficulty / 100,
      weight_semantic_similarity: weights.semantic / 100,
      weight_examiner_behavior: weights.examiner / 100,
    });
  };

  const factors = [
    { key: "trend", label: "Trend Momentum", desc: "Weight of trend direction & recency", color: "hsl(var(--primary))", icon: TrendingUp },
    { key: "timeSeries", label: "Time-Series Forecast", desc: "EWMA-based forecasting weight", color: "hsl(var(--accent))", icon: Activity },
    { key: "frequency", label: "Historical Frequency", desc: "Past occurrence count weight", color: "hsl(142, 76%, 36%)", icon: BarChart3 },
    { key: "difficulty", label: "Difficulty Alignment", desc: "Consistency of difficulty distribution", color: "hsl(38, 92%, 50%)", icon: Target },
    { key: "semantic", label: "Semantic Similarity", desc: "Question text similarity analysis", color: "hsl(270, 76%, 55%)", icon: Brain },
    { key: "examiner", label: "Examiner Behavior", desc: "Cyclical repetition detection", color: "hsl(340, 82%, 52%)", icon: Eye },
  ];

  return (
    <div className="space-y-6">
      {/* Formula Display */}
      <div className="rounded-xl bg-card border border-border/50 p-4">
        <h4 className="text-sm font-bold text-foreground mb-2">Hybrid 6-Factor Prediction Formula</h4>
        <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
          Final Score = (Trend × {(weights.trend / 100).toFixed(2)}) + (TimeSeries × {(weights.timeSeries / 100).toFixed(2)}) + (Frequency × {(weights.frequency / 100).toFixed(2)}) + (Difficulty × {(weights.difficulty / 100).toFixed(2)}) + (Semantic × {(weights.semantic / 100).toFixed(2)}) + (Examiner × {(weights.examiner / 100).toFixed(2)})
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className={`text-xs font-bold ${isValid ? "text-success" : "text-destructive"}`}>
            Total: {Math.round(total)}%
          </span>
          {!isValid && (
            <span className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Must equal 100%
            </span>
          )}
        </div>
      </div>

      {/* Weight Sliders */}
      <div className="space-y-3">
        {factors.map(f => {
          const Icon = f.icon;
          const value = weights[f.key as keyof typeof weights];
          return (
            <div key={f.key} className="rounded-xl bg-card border border-border/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: f.color }} />
                  <span className="text-sm font-medium text-foreground">{f.label}</span>
                </div>
                <span className="text-sm font-bold text-foreground tabular-nums">{Math.round(value)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={value}
                onChange={e => updateWeight(f.key, parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="text-[9px] text-muted-foreground mt-1">{f.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <button
        onClick={saveWeights}
        disabled={!isValid || saving}
        className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:bg-primary/90"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {saving ? "Saving..." : "Apply Weight Changes"}
      </button>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center italic">
        ⚠️ Weight changes dynamically recalculate all prediction scores. Changes take effect on next prediction generation.
      </p>
    </div>
  );
};

export default SureShotAdminPanel;
