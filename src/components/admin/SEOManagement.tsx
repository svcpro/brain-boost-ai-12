import { useState } from "react";
import { Search, FileText, Key, Link2, Map, Code, Sparkles } from "lucide-react";
import SEODashboard from "./seo/SEODashboard";
import SEOPageManager from "./seo/SEOPageManager";
import SEOKeywordManager from "./seo/SEOKeywordManager";
import SEORedirectManager from "./seo/SEORedirectManager";
import SEOSitemapManager from "./seo/SEOSitemapManager";
import SEOSchemaManager from "./seo/SEOSchemaManager";
import SEOAISuggestions from "./seo/SEOAISuggestions";

type TabId = "dashboard" | "pages" | "keywords" | "redirects" | "sitemap" | "schema" | "ai";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: Search },
  { id: "pages", label: "Page SEO", icon: FileText },
  { id: "keywords", label: "Keywords", icon: Key },
  { id: "redirects", label: "Redirects", icon: Link2 },
  { id: "sitemap", label: "Sitemap", icon: Map },
  { id: "schema", label: "Schema", icon: Code },
  { id: "ai", label: "AI Suggestions", icon: Sparkles },
];

const SEOManagement = () => {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Search className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">SEO Command Center</h2>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <SEODashboard />}
      {tab === "pages" && <SEOPageManager />}
      {tab === "keywords" && <SEOKeywordManager />}
      {tab === "redirects" && <SEORedirectManager />}
      {tab === "sitemap" && <SEOSitemapManager />}
      {tab === "schema" && <SEOSchemaManager />}
      {tab === "ai" && <SEOAISuggestions />}
    </div>
  );
};

export default SEOManagement;
