import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SCHEMA_TEMPLATES: Record<string, any> = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ACRY - AI Second Brain",
    url: "https://acry.ai",
    description: "AI-powered exam preparation platform",
  },
  article: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "",
    author: { "@type": "Organization", name: "ACRY" },
    datePublished: "",
  },
  faq: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [{ "@type": "Question", name: "", acceptedAnswer: { "@type": "Answer", text: "" } }],
  },
  breadcrumb: {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "/" }],
  },
};

const SEOSchemaManager = () => {
  const { toast } = useToast();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [schema, setSchema] = useState("");
  const [saving, setSaving] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchPages = async () => {
    const { data } = await supabase.from("seo_pages").select("id, page_url, schema_markup_json").order("page_url");
    const list = data || [];
    setPages(list);
    setLoading(false);
    // Auto-select first page if none selected
    if (list.length > 0 && !selectedPage) {
      setSelectedPage(list[0].id);
      setSchema(JSON.stringify(list[0].schema_markup_json || {}, null, 2));
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const selectPage = (id: string) => {
    const page = pages.find(p => p.id === id);
    setSelectedPage(id);
    setSchema(JSON.stringify(page?.schema_markup_json || {}, null, 2));
  };

  const applyTemplate = (key: string) => {
    setSchema(JSON.stringify(SCHEMA_TEMPLATES[key], null, 2));
  };

  const createPageAndSave = async () => {
    if (!newUrl.trim()) {
      toast({ title: "Enter a page URL", variant: "destructive" });
      return;
    }
    let parsed: any;
    try {
      parsed = schema ? JSON.parse(schema) : {};
    } catch {
      toast({ title: "Invalid JSON", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.from("seo_pages").insert({
      page_url: newUrl.trim(),
      page_type: "landing",
      schema_markup_json: parsed,
      robots_index: true,
      robots_follow: true,
      seo_score: 10,
    }).select().maybeSingle();
    setCreating(false);
    if (error) {
      toast({ title: "Failed to create page", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Page created with schema" });
      setNewUrl("");
      setSelectedPage(data?.id || null);
      await fetchPages();
    }
  };

  const saveSchema = async () => {
    if (!selectedPage) return;
    let parsed: any;
    try {
      parsed = JSON.parse(schema);
    } catch {
      toast({ title: "Invalid JSON", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("seo_pages").update({ schema_markup_json: parsed }).eq("id", selectedPage);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Schema saved" });
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Page</p>
          <div className="space-y-1 max-h-72 overflow-auto">
            {pages.map(p => (
              <button key={p.id} onClick={() => selectPage(p.id)} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${selectedPage === p.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                {p.page_url}
              </button>
            ))}
          </div>
          {/* Quick add page */}
          <div className="pt-2 border-t border-border space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Quick Add Page</p>
            <input
              className="w-full px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground"
              placeholder="/new-page-url"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
            />
            <button
              onClick={createPageAndSave}
              disabled={creating || !newUrl.trim()}
              className="w-full px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Create & Save Schema
            </button>
          </div>
        </div>

        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Templates:</span>
            {Object.keys(SCHEMA_TEMPLATES).map(k => (
              <button key={k} onClick={() => applyTemplate(k)} className="px-2 py-1 rounded bg-secondary text-xs text-foreground hover:bg-secondary/80 capitalize">{k}</button>
            ))}
          </div>
          <textarea className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground font-mono" rows={16} value={schema} onChange={e => setSchema(e.target.value)} placeholder="Select a page or create one, then add schema JSON..." />
          <button onClick={saveSchema} disabled={saving || !selectedPage} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Schema
          </button>
          {!selectedPage && pages.length === 0 && (
            <p className="text-xs text-muted-foreground">No pages yet. Use "Quick Add Page" on the left or add pages in the Page SEO tab first.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SEOSchemaManager;
