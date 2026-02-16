import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, Globe, AlertTriangle, Search, FileText, Link2, Map, Loader2,
  Sparkles, Shield, Zap, TrendingUp, Target, Brain, Activity, RefreshCw, CheckCircle2, XCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalPages: number;
  indexedPages: number;
  missingMeta: number;
  missingOG: number;
  missingSchema: number;
  missingCanonical: number;
  avgScore: number;
  totalKeywords: number;
  totalRedirects: number;
  sitemapEntries: number;
  pendingSuggestions: number;
  highScorePages: number;
  lowScorePages: number;
}

const SEODashboard = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [scoreDistribution, setScoreDistribution] = useState<{ range: string; count: number }[]>([]);
  const [topPages, setTopPages] = useState<any[]>([]);
  const [pageTypeBreakdown, setPageTypeBreakdown] = useState<{ name: string; value: number }[]>([]);
  const [healthRadar, setHealthRadar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState<any>(null);
  const [auditing, setAuditing] = useState(false);
  const [contentGap, setContentGap] = useState<any>(null);
  const [analyzingGap, setAnalyzingGap] = useState(false);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    const [pagesRes, keywordsRes, redirectsRes, sitemapRes, suggestionsRes, analyticsRes] = await Promise.all([
      supabase.from("seo_pages").select("*"),
      supabase.from("seo_keywords").select("id", { count: "exact", head: true }),
      supabase.from("seo_redirects").select("id", { count: "exact", head: true }),
      supabase.from("seo_sitemap").select("id", { count: "exact", head: true }),
      supabase.from("seo_ai_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("seo_analytics").select("*").order("clicks", { ascending: false }).limit(10),
    ]);

    const pages = pagesRes.data || [];
    const indexed = pages.filter(p => p.robots_index).length;
    const missingMeta = pages.filter(p => !p.meta_title || !p.meta_description).length;
    const missingOG = pages.filter(p => !p.og_title || !p.og_image).length;
    const missingSchema = pages.filter(p => !p.schema_markup_json || Object.keys(p.schema_markup_json).length === 0).length;
    const missingCanonical = pages.filter(p => !p.canonical_url).length;
    const avgScore = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + (p.seo_score || 0), 0) / pages.length) : 0;
    const highScorePages = pages.filter(p => (p.seo_score || 0) >= 80).length;
    const lowScorePages = pages.filter(p => (p.seo_score || 0) < 40).length;

    setStats({
      totalPages: pages.length, indexedPages: indexed, missingMeta, missingOG, missingSchema, missingCanonical,
      avgScore, totalKeywords: keywordsRes.count || 0, totalRedirects: redirectsRes.count || 0,
      sitemapEntries: sitemapRes.count || 0, pendingSuggestions: suggestionsRes.count || 0,
      highScorePages, lowScorePages,
    });

    const ranges = [
      { range: "0-20", min: 0, max: 20 }, { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 }, { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];
    setScoreDistribution(ranges.map(r => ({
      range: r.range, count: pages.filter(p => (p.seo_score || 0) >= r.min && (p.seo_score || 0) <= r.max).length,
    })));

    // Page type breakdown
    const types: Record<string, number> = {};
    pages.forEach(p => { types[p.page_type] = (types[p.page_type] || 0) + 1; });
    setPageTypeBreakdown(Object.entries(types).map(([name, value]) => ({ name, value })));

    // Health radar
    const total = pages.length || 1;
    setHealthRadar([
      { metric: "Titles", score: Math.round(((total - missingMeta) / total) * 100) },
      { metric: "OG Tags", score: Math.round(((total - missingOG) / total) * 100) },
      { metric: "Schema", score: Math.round(((total - missingSchema) / total) * 100) },
      { metric: "Canonical", score: Math.round(((total - missingCanonical) / total) * 100) },
      { metric: "Indexed", score: Math.round((indexed / total) * 100) },
      { metric: "Keywords", score: Math.min(100, ((keywordsRes.count || 0) / total) * 100) },
    ]);

    setTopPages(analyticsRes.data || []);
    setLoading(false);
  };

  const runAIAudit = async () => {
    setAuditing(true);
    try {
      const res = await supabase.functions.invoke("seo-ai-optimize", { body: { action: "audit" } });
      if (res.error) throw res.error;
      setAuditData(res.data);
      toast({ title: "AI Audit Complete", description: `Health Score: ${res.data?.overall_score || 0}%` });
    } catch (e: any) {
      toast({ title: "Audit Failed", description: e.message, variant: "destructive" });
    }
    setAuditing(false);
  };

  const runContentGapAnalysis = async () => {
    setAnalyzingGap(true);
    try {
      const res = await supabase.functions.invoke("seo-ai-optimize", { body: { action: "content-gap" } });
      if (res.error) throw res.error;
      setContentGap(res.data);
      toast({ title: "Content Gap Analysis Complete" });
    } catch (e: any) {
      toast({ title: "Analysis Failed", description: e.message, variant: "destructive" });
    }
    setAnalyzingGap(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const scoreGrade = stats.avgScore >= 80 ? "A" : stats.avgScore >= 60 ? "B" : stats.avgScore >= 40 ? "C" : "D";
  const scoreColor = stats.avgScore >= 80 ? "text-green-400" : stats.avgScore >= 60 ? "text-yellow-400" : "text-destructive";

  const statCards = [
    { label: "Total Pages", value: stats.totalPages, icon: FileText, color: "text-primary" },
    { label: "Indexed", value: stats.indexedPages, icon: Globe, color: "text-green-400" },
    { label: "Missing Meta", value: stats.missingMeta, icon: AlertTriangle, color: "text-destructive" },
    { label: "Missing OG", value: stats.missingOG, icon: AlertTriangle, color: "text-orange-400" },
    { label: "No Schema", value: stats.missingSchema, icon: AlertTriangle, color: "text-yellow-400" },
    { label: "No Canonical", value: stats.missingCanonical, icon: Link2, color: "text-red-400" },
    { label: "Keywords", value: stats.totalKeywords, icon: Search, color: "text-blue-400" },
    { label: "AI Pending", value: stats.pendingSuggestions, icon: Sparkles, color: "text-purple-400" },
  ];

  const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-6">
      {/* Hero Score */}
      <div className="glass rounded-2xl neural-border p-6 flex items-center gap-6">
        <div className="w-24 h-24 rounded-full border-4 border-primary flex items-center justify-center bg-primary/10">
          <div className="text-center">
            <span className={`text-3xl font-black ${scoreColor}`}>{scoreGrade}</span>
            <p className="text-xs text-muted-foreground">{stats.avgScore}%</p>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">SEO Health Score</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.highScorePages} pages optimized • {stats.lowScorePages} need attention • {stats.pendingSuggestions} AI suggestions pending
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={runAIAudit} disabled={auditing} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1.5">
              {auditing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />} AI Full Audit
            </button>
            <button onClick={runContentGapAnalysis} disabled={analyzingGap} className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium flex items-center gap-1.5">
              {analyzingGap ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />} Content Gap Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(s => (
          <div key={s.label} className="glass rounded-xl neural-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI Audit Results */}
      {auditData && (
        <div className="glass rounded-2xl neural-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">AI SEO Audit Report</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-black ${(auditData.overall_score || 0) >= 70 ? "text-green-400" : "text-destructive"}`}>{auditData.overall_score || 0}%</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{auditData.grade || "?"}</span>
            </div>
          </div>

          {auditData.critical_issues?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1"><XCircle className="w-3 h-3" /> Critical Issues</p>
              {auditData.critical_issues.map((i: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-medium text-foreground">{i.issue}</p>
                  <p className="text-xs text-muted-foreground mt-1">Impact: {i.impact}</p>
                  <p className="text-xs text-primary mt-1">Fix: {i.fix}</p>
                </div>
              ))}
            </div>
          )}

          {auditData.warnings?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Warnings</p>
              {auditData.warnings.slice(0, 5).map((w: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-foreground">{w.issue}</p>
                  <p className="text-xs text-muted-foreground mt-1">{w.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          {auditData.opportunities?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1"><Zap className="w-3 h-3" /> Opportunities</p>
              {auditData.opportunities.slice(0, 5).map((o: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-foreground">{o.opportunity}</p>
                  <p className="text-xs text-muted-foreground mt-1">Impact: {o.potential_impact}</p>
                </div>
              ))}
            </div>
          )}

          {auditData.quick_wins?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Quick Wins</p>
              <div className="flex flex-wrap gap-2">
                {auditData.quick_wins.map((q: string, idx: number) => (
                  <span key={idx} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{q}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Gap Analysis */}
      {contentGap && (
        <div className="glass rounded-2xl neural-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-bold text-foreground">Content Gap Analysis</h3>
          </div>

          {contentGap.missing_pages?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Missing Pages ({contentGap.missing_pages.length})</p>
              <div className="space-y-1">
                {contentGap.missing_pages.slice(0, 8).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <div>
                      <span className="text-xs font-medium text-primary">{p.url}</span>
                      <p className="text-[10px] text-muted-foreground">{p.title}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{p.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contentGap.topic_clusters?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Topic Clusters Needed</p>
              <div className="flex flex-wrap gap-2">
                {contentGap.topic_clusters.map((c: any, i: number) => (
                  <span key={i} className={`text-xs px-2 py-1 rounded-full font-medium ${c.priority === "high" ? "bg-destructive/15 text-destructive" : c.priority === "medium" ? "bg-yellow-500/15 text-yellow-400" : "bg-secondary text-muted-foreground"}`}>
                    {c.cluster} ({c.pages_needed} pages)
                  </span>
                ))}
              </div>
            </div>
          )}

          {contentGap.quick_wins?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Quick Wins</p>
              {contentGap.quick_wins.slice(0, 5).map((q: any, i: number) => (
                <div key={i} className="p-2 rounded-lg bg-green-500/5 border border-green-500/10 mb-1">
                  <span className="text-xs text-foreground">{q.action}</span>
                  <span className="text-[10px] text-green-400 ml-2">→ {q.impact}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Health Radar */}
        <div className="glass rounded-xl neural-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> SEO Health Radar</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={healthRadar}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
              <Radar name="Health" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score Distribution */}
        <div className="glass rounded-xl neural-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={scoreDistribution}>
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {scoreDistribution.map((_, i) => (
                  <Cell key={i} fill={i < 2 ? "hsl(var(--destructive))" : i === 2 ? "#f59e0b" : "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Page Type Breakdown */}
        <div className="glass rounded-xl neural-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Page Type Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pageTypeBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                {pageTypeBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Pages */}
        <div className="glass rounded-xl neural-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" /> Top Pages by Performance</h3>
          {topPages.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No analytics data yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-auto">
              {topPages.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold w-5 ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
                    <span className="text-xs text-foreground truncate">{p.page_url}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                    <span className="text-green-400">{p.clicks} clicks</span>
                    <span>{p.impressions} imp</span>
                    {p.ranking_position && <span className="text-primary">#{p.ranking_position}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SEODashboard;
