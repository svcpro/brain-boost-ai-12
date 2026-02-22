import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Brain, FileText, BarChart3, Plus, Play, Eye,
  ChevronRight, Loader2, CheckCircle2, Lightbulb, Scale,
  Globe, BookOpen, Landmark, TrendingUp, PenTool
} from "lucide-react";
import { useDebateDashboard, useDebateAnalyses, useDebateAnalysisDetail, useGenerateAnalysis, useApplyFrameworks } from "@/hooks/useDebateEngine";

type Tab = "dashboard" | "analyses" | "detail" | "create";

const FRAMEWORK_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  pestle: { label: "PESTLE", icon: BarChart3, color: "text-blue-400" },
  stakeholder: { label: "Stakeholder Map", icon: Brain, color: "text-purple-400" },
  cost_benefit: { label: "Cost-Benefit", icon: Scale, color: "text-green-400" },
  long_short_term: { label: "Long vs Short Term", icon: TrendingUp, color: "text-orange-400" },
};

export default function DebateEngineAdmin() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ title: "", context: "", event_id: "" });

  const dashboard = useDebateDashboard();
  const analyses = useDebateAnalyses();
  const detail = useDebateAnalysisDetail(selectedId);
  const generateAnalysis = useGenerateAnalysis();
  const applyFrameworks = useApplyFrameworks();

  const handleGenerate = () => {
    if (!newTopic.title.trim()) return;
    generateAnalysis.mutate(
      { topic_title: newTopic.title, topic_context: newTopic.context, event_id: newTopic.event_id || undefined },
      {
        onSuccess: (data: any) => {
          setSelectedId(data.id);
          setTab("detail");
          setNewTopic({ title: "", context: "", event_id: "" });
        },
      }
    );
  };

  const stats = dashboard.data || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
            <Swords className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">CA 4.0 – Debate & Writing Engine</h2>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold">AI</span>
            </div>
            <p className="text-xs text-muted-foreground">Multi-angle analysis, frameworks & writing evaluation</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { key: "dashboard", label: "Dashboard", icon: BarChart3 },
          { key: "analyses", label: "Analyses", icon: Brain },
          { key: "create", label: "New Analysis", icon: Plus },
        ] as { key: Tab; label: string; icon: any }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {/* Dashboard */}
          {tab === "dashboard" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Analyses", value: stats.totalAnalyses || 0, icon: Brain, color: "text-blue-400" },
                  { label: "Frameworks", value: stats.totalFrameworks || 0, icon: BarChart3, color: "text-purple-400" },
                  { label: "Evaluations", value: stats.totalEvaluations || 0, icon: PenTool, color: "text-green-400" },
                  { label: "Avg Score", value: `${stats.avgWritingScore || 0}/10`, icon: TrendingUp, color: "text-orange-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Pipeline Flow */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">CA 4.0 Pipeline</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {["Topic Input", "Multi-Angle Analysis", "PESTLE", "Stakeholder Map", "Cost-Benefit", "Long/Short Term", "Writing Practice", "AI Evaluation"].map((stage, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">{stage}</div>
                      {i < 7 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Analyses List */}
          {tab === "analyses" && (
            <div className="space-y-3">
              {analyses.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
              {analyses.data?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No analyses yet. Create one to get started.</div>
              )}
              {analyses.data?.map((a: any) => (
                <div key={a.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => { setSelectedId(a.id); setTab("detail"); }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground text-sm">{a.topic_title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.topic_context}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          a.status === "frameworks_applied" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                        }`}>{a.status}</span>
                        <span className="text-[10px] text-muted-foreground">Relevance: {a.exam_relevance_score}%</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detail View */}
          {tab === "detail" && selectedId && (
            <div className="space-y-4">
              {detail.isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
              {detail.data?.analysis && (
                <>
                  <div className="flex items-center justify-between">
                    <button onClick={() => setTab("analyses")} className="text-xs text-primary hover:underline">← Back to list</button>
                    {detail.data.analysis.status !== "frameworks_applied" && (
                      <button
                        onClick={() => applyFrameworks.mutate(selectedId)}
                        disabled={applyFrameworks.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 disabled:opacity-50"
                      >
                        {applyFrameworks.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Apply All Frameworks
                      </button>
                    )}
                  </div>

                  <div className="bg-card border border-border rounded-xl p-4">
                    <h3 className="text-lg font-bold text-foreground">{detail.data.analysis.topic_title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{detail.data.analysis.topic_context}</p>
                  </div>

                  {/* Multi-Angle Analysis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Pro Arguments */}
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <h4 className="text-sm font-semibold text-foreground">Pro Arguments</h4>
                      </div>
                      <div className="space-y-2">
                        {(detail.data.analysis.pro_arguments || []).map((arg: any, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground">
                            <span className="font-medium text-green-400">• {arg.point || arg}</span>
                            {arg.explanation && <p className="ml-3 mt-0.5">{arg.explanation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Counter Arguments */}
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Swords className="w-4 h-4 text-red-400" />
                        <h4 className="text-sm font-semibold text-foreground">Counter Arguments</h4>
                      </div>
                      <div className="space-y-2">
                        {(detail.data.analysis.counter_arguments || []).map((arg: any, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground">
                            <span className="font-medium text-red-400">• {arg.point || arg}</span>
                            {arg.explanation && <p className="ml-3 mt-0.5">{arg.explanation}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { label: "Ethical Dimension", icon: Lightbulb, color: "text-yellow-400", content: detail.data.analysis.ethical_dimension },
                      { label: "Economic Dimension", icon: BarChart3, color: "text-blue-400", content: detail.data.analysis.economic_dimension },
                      { label: "Constitutional Link", icon: Landmark, color: "text-purple-400", content: detail.data.analysis.constitutional_link },
                      { label: "International Perspective", icon: Globe, color: "text-cyan-400", content: detail.data.analysis.international_perspective },
                    ].map((dim, i) => (
                      <div key={i} className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <dim.icon className={`w-4 h-4 ${dim.color}`} />
                          <h4 className="text-sm font-semibold text-foreground">{dim.label}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{dim.content || "Not generated yet"}</p>
                      </div>
                    ))}
                  </div>

                  {/* Frameworks */}
                  {detail.data.frameworks.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Applied Frameworks</h3>
                      {detail.data.frameworks.map((fw: any) => {
                        const meta = FRAMEWORK_LABELS[fw.framework_type] || { label: fw.framework_type, icon: FileText, color: "text-muted-foreground" };
                        return (
                          <div key={fw.id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <meta.icon className={`w-4 h-4 ${meta.color}`} />
                              <h4 className="text-sm font-semibold text-foreground">{meta.label}</h4>
                            </div>
                            <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-48">
                              {JSON.stringify(fw.framework_data, null, 2)}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Create New Analysis */}
          {tab === "create" && (
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-2xl">
              <h3 className="text-sm font-semibold text-foreground">Generate Multi-Angle Analysis</h3>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Topic Title *</label>
                <input
                  value={newTopic.title}
                  onChange={e => setNewTopic(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., National Education Policy 2020"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Context / Description</label>
                <textarea
                  value={newTopic.context}
                  onChange={e => setNewTopic(p => ({ ...p, context: e.target.value }))}
                  placeholder="Provide background context for AI analysis..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Link to CA Event (optional)</label>
                <input
                  value={newTopic.event_id}
                  onChange={e => setNewTopic(p => ({ ...p, event_id: e.target.value }))}
                  placeholder="Event UUID (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={!newTopic.title.trim() || generateAnalysis.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {generateAnalysis.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Analysis...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4" />
                    Generate Multi-Angle Analysis
                  </>
                )}
              </button>
              <p className="text-[10px] text-muted-foreground">
                AI will generate pro/counter arguments, ethical/economic/constitutional/international dimensions, then you can apply PESTLE, Stakeholder, Cost-Benefit, and Long/Short term frameworks.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
