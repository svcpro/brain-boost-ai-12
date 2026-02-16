import { useState } from "react";
import { Search, FileText, Key, Link2, Map, Code, Sparkles, Shield, Target, Brain, BarChart3, Zap } from "lucide-react";
import SEODashboard from "./seo/SEODashboard";
import SEOPageManager from "./seo/SEOPageManager";
import SEOKeywordManager from "./seo/SEOKeywordManager";
import SEORedirectManager from "./seo/SEORedirectManager";
import SEOSitemapManager from "./seo/SEOSitemapManager";
import SEOSchemaManager from "./seo/SEOSchemaManager";
import SEOAISuggestions from "./seo/SEOAISuggestions";

type TabId = "dashboard" | "pages" | "keywords" | "redirects" | "sitemap" | "schema" | "ai";

const TABS: { id: TabId; label: string; icon: any; description: string }[] = [
  { id: "dashboard", label: "AI Dashboard", icon: Brain, description: "Health score, audit, gap analysis" },
  { id: "ai", label: "AI Optimizer", icon: Sparkles, description: "Auto-fix, suggestions, bulk optimize" },
  { id: "pages", label: "Page SEO", icon: FileText, description: "SERP preview, scoring, auto-fix" },
  { id: "keywords", label: "Keywords", icon: Key, description: "AI research, clustering, mapping" },
  { id: "redirects", label: "Redirects", icon: Link2, description: "301/302, toggle, bulk manage" },
  { id: "sitemap", label: "Sitemap", icon: Map, description: "Auto-generate, priority control" },
  { id: "schema", label: "Schema", icon: Code, description: "JSON-LD templates, validation" },
];

const SEOManagement = () => {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">AI SEO Command Center</h2>
          <p className="text-xs text-muted-foreground">Ultra-advanced AI-powered SEO management for fast Google ranking</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              tab === t.id 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <SEODashboard />}
      {tab === "ai" && <SEOAISuggestions />}
      {tab === "pages" && <SEOPageManager />}
      {tab === "keywords" && <SEOKeywordManager />}
      {tab === "redirects" && <SEORedirectManager />}
      {tab === "sitemap" && <SEOSitemapManager />}
      {tab === "schema" && <SEOSchemaManager />}
    </div>
  );
};

export default SEOManagement;
