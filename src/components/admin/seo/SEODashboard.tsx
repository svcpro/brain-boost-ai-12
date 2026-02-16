import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Globe, AlertTriangle, Search, FileText, Link2, Map, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface DashboardStats {
  totalPages: number;
  indexedPages: number;
  missingMeta: number;
  avgScore: number;
  totalKeywords: number;
  totalRedirects: number;
  sitemapEntries: number;
  pendingSuggestions: number;
}

const SEODashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [scoreDistribution, setScoreDistribution] = useState<{ range: string; count: number }[]>([]);
  const [topPages, setTopPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const [pagesRes, keywordsRes, redirectsRes, sitemapRes, suggestionsRes, analyticsRes] = await Promise.all([
      supabase.from("seo_pages").select("*"),
      supabase.from("seo_keywords").select("id", { count: "exact", head: true }),
      supabase.from("seo_redirects").select("id", { count: "exact", head: true }),
      supabase.from("seo_sitemap").select("id", { count: "exact", head: true }),
      supabase.from("seo_ai_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("seo_analytics").select("*").order("clicks", { ascending: false }).limit(5),
    ]);

    const pages = pagesRes.data || [];
    const indexed = pages.filter(p => p.robots_index).length;
    const missingMeta = pages.filter(p => !p.meta_title || !p.meta_description).length;
    const avgScore = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + (p.seo_score || 0), 0) / pages.length) : 0;

    setStats({
      totalPages: pages.length,
      indexedPages: indexed,
      missingMeta,
      avgScore,
      totalKeywords: keywordsRes.count || 0,
      totalRedirects: redirectsRes.count || 0,
      sitemapEntries: sitemapRes.count || 0,
      pendingSuggestions: suggestionsRes.count || 0,
    });

    // Score distribution
    const ranges = [
      { range: "0-20", min: 0, max: 20 },
      { range: "21-40", min: 21, max: 40 },
      { range: "41-60", min: 41, max: 60 },
      { range: "61-80", min: 61, max: 80 },
      { range: "81-100", min: 81, max: 100 },
    ];
    setScoreDistribution(ranges.map(r => ({
      range: r.range,
      count: pages.filter(p => (p.seo_score || 0) >= r.min && (p.seo_score || 0) <= r.max).length,
    })));

    setTopPages(analyticsRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const statCards = [
    { label: "Total Pages", value: stats.totalPages, icon: FileText, color: "text-primary" },
    { label: "Indexed Pages", value: stats.indexedPages, icon: Globe, color: "text-green-400" },
    { label: "Missing Meta", value: stats.missingMeta, icon: AlertTriangle, color: "text-destructive" },
    { label: "Avg SEO Score", value: `${stats.avgScore}%`, icon: BarChart3, color: "text-accent" },
    { label: "Keywords", value: stats.totalKeywords, icon: Search, color: "text-blue-400" },
    { label: "Redirects", value: stats.totalRedirects, icon: Link2, color: "text-orange-400" },
    { label: "Sitemap Entries", value: stats.sitemapEntries, icon: Map, color: "text-purple-400" },
    { label: "AI Suggestions", value: stats.pendingSuggestions, icon: BarChart3, color: "text-yellow-400" },
  ];

  const COLORS = ["hsl(var(--destructive))", "hsl(var(--warning, 30 90% 50%))", "hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--accent))"];

  return (
    <div className="space-y-6">
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

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl neural-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">SEO Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistribution}>
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl neural-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Pages by Clicks</h3>
          {topPages.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">No analytics data yet</p>
          ) : (
            <div className="space-y-2">
              {topPages.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-primary w-5">{i + 1}</span>
                    <span className="text-xs text-foreground truncate">{p.page_url}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{p.clicks} clicks</span>
                    <span>{p.impressions} imp</span>
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
