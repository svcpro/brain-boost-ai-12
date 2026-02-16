import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Search, Loader2, Save, X, Eye, EyeOff, Sparkles, Zap, Globe, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SEOPage {
  id: string;
  page_url: string;
  page_type: string;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  canonical_url: string | null;
  robots_index: boolean;
  robots_follow: boolean;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_title: string | null;
  twitter_description: string | null;
  twitter_image: string | null;
  schema_markup_json: any;
  seo_score: number | null;
}

const PAGE_TYPES = ["landing", "community", "discussion", "dynamic", "public"];

const SEOPageManager = () => {
  const { toast } = useToast();
  const [pages, setPages] = useState<SEOPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SEOPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkEdit, setBulkEdit] = useState(false);
  const [bulkData, setBulkData] = useState({ robots_index: true, robots_follow: true });
  const [autoFixing, setAutoFixing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const emptyPage: SEOPage = {
    id: "", page_url: "", page_type: "landing", meta_title: "", meta_description: "", meta_keywords: [],
    canonical_url: "", robots_index: true, robots_follow: true, og_title: "", og_description: "", og_image: "",
    twitter_title: "", twitter_description: "", twitter_image: "", schema_markup_json: {}, seo_score: 0,
  };

  useEffect(() => { fetchPages(); }, []);

  const fetchPages = async () => {
    setLoading(true);
    const { data } = await supabase.from("seo_pages").select("*").order("updated_at", { ascending: false });
    setPages((data || []) as SEOPage[]);
    setLoading(false);
  };

  const savePage = async () => {
    if (!editing) return;
    setSaving(true);
    const score = calcScore(editing);
    const payload: any = { ...editing, seo_score: score };
    delete payload.id;
    if (editing.id) {
      const { error } = await supabase.from("seo_pages").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Updated" });
    } else {
      const { error } = await supabase.from("seo_pages").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Created" });
    }
    setSaving(false); setEditing(null); setCreating(false); fetchPages();
  };

  const deletePage = async (id: string) => {
    await supabase.from("seo_pages").delete().eq("id", id);
    toast({ title: "Deleted" }); fetchPages();
  };

  const applyBulkEdit = async () => {
    if (bulkSelected.length === 0) return;
    setSaving(true);
    for (const id of bulkSelected) {
      await supabase.from("seo_pages").update(bulkData).eq("id", id);
    }
    toast({ title: `Updated ${bulkSelected.length} pages` });
    setBulkSelected([]); setBulkEdit(false); setSaving(false); fetchPages();
  };

  const runAutoFix = async () => {
    setAutoFixing(true);
    try {
      const res = await supabase.functions.invoke("seo-ai-optimize", { body: { action: "auto-fix" } });
      if (res.error) throw res.error;
      toast({ title: "AI Auto-Fix Complete", description: `Fixed ${res.data?.fixed || 0} pages` });
      fetchPages();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setAutoFixing(false);
  };

  const filtered = pages.filter(p => {
    const matchSearch = !search || p.page_url.toLowerCase().includes(search.toLowerCase()) || (p.meta_title || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || p.page_type === filterType;
    return matchSearch && matchType;
  });

  const calcScore = (p: SEOPage) => {
    let score = 0;
    if (p.meta_title && p.meta_title.length > 10 && p.meta_title.length <= 60) score += 15;
    else if (p.meta_title) score += 8;
    if (p.meta_description && p.meta_description.length > 50 && p.meta_description.length <= 160) score += 15;
    else if (p.meta_description) score += 8;
    if (p.canonical_url) score += 10;
    if (p.og_title) score += 8;
    if (p.og_image) score += 7;
    if (p.og_description) score += 5;
    if (p.twitter_title) score += 5;
    if (p.twitter_image) score += 5;
    if (p.twitter_description) score += 5;
    if (p.meta_keywords && p.meta_keywords.length > 0) score += 10;
    if (p.meta_keywords && p.meta_keywords.length >= 5) score += 5;
    if (p.schema_markup_json && Object.keys(p.schema_markup_json).length > 0) score += 10;
    return Math.min(100, score);
  };

  const titleQuality = (title: string | null) => {
    if (!title) return { label: "Missing", color: "text-destructive" };
    if (title.length < 20) return { label: "Too Short", color: "text-yellow-400" };
    if (title.length > 60) return { label: "Too Long", color: "text-orange-400" };
    return { label: "Good", color: "text-green-400" };
  };

  const descQuality = (desc: string | null) => {
    if (!desc) return { label: "Missing", color: "text-destructive" };
    if (desc.length < 70) return { label: "Too Short", color: "text-yellow-400" };
    if (desc.length > 160) return { label: "Too Long", color: "text-orange-400" };
    return { label: "Good", color: "text-green-400" };
  };

  const brokenCount = pages.filter(p => !p.meta_title || !p.meta_description || !p.og_title || !p.canonical_url).length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (editing || creating) {
    const page = editing || emptyPage;
    const tq = titleQuality(page.meta_title);
    const dq = descQuality(page.meta_description);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{editing?.id ? "Edit Page SEO" : "Add New Page"}</h3>
          <button onClick={() => { setEditing(null); setCreating(false); setShowPreview(false); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* SERP Preview */}
        <div className="glass rounded-xl neural-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Globe className="w-3 h-3" /> Google SERP Preview</span>
            <span className="text-xs font-bold text-primary">Score: {calcScore(page)}%</span>
          </div>
          <div className="bg-background rounded-lg p-3 border border-border">
            <p className="text-blue-400 text-base font-medium truncate">{page.meta_title || "Page Title — ACRY"}</p>
            <p className="text-green-500 text-xs mt-0.5">{page.page_url ? `brain-boost-ai-12.lovable.app${page.page_url}` : "brain-boost-ai-12.lovable.app"}</p>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{page.meta_description || "Add a compelling meta description to improve click-through rates..."}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block"><span className="text-xs text-muted-foreground">Page URL *</span>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.page_url} onChange={e => setEditing({ ...page, page_url: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">Page Type</span>
              <select className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.page_type} onChange={e => setEditing({ ...page, page_type: e.target.value })}>
                {PAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Meta Title</span>
                <span className={`text-[10px] font-bold ${tq.color}`}>{tq.label} • {(page.meta_title || "").length}/60</span>
              </div>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.meta_title || ""} onChange={e => setEditing({ ...page, meta_title: e.target.value })} maxLength={70} />
              <div className="w-full h-1 mt-1 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${(page.meta_title || "").length <= 60 ? "bg-green-400" : "bg-destructive"}`} style={{ width: `${Math.min(100, ((page.meta_title || "").length / 60) * 100)}%` }} />
              </div>
            </label>
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Meta Description</span>
                <span className={`text-[10px] font-bold ${dq.color}`}>{dq.label} • {(page.meta_description || "").length}/160</span>
              </div>
              <textarea className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" rows={3} value={page.meta_description || ""} onChange={e => setEditing({ ...page, meta_description: e.target.value })} maxLength={200} />
              <div className="w-full h-1 mt-1 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${(page.meta_description || "").length <= 160 ? "bg-green-400" : "bg-destructive"}`} style={{ width: `${Math.min(100, ((page.meta_description || "").length / 160) * 100)}%` }} />
              </div>
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">Meta Keywords (comma separated)</span>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={(page.meta_keywords || []).join(", ")} onChange={e => setEditing({ ...page, meta_keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) })} />
              <span className="text-[10px] text-muted-foreground">{(page.meta_keywords || []).length} keywords</span>
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">Canonical URL</span>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.canonical_url || ""} onChange={e => setEditing({ ...page, canonical_url: e.target.value })} />
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={page.robots_index} onChange={e => setEditing({ ...page, robots_index: e.target.checked })} className="rounded" /> Index
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={page.robots_follow} onChange={e => setEditing({ ...page, robots_follow: e.target.checked })} className="rounded" /> Follow
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Graph</p>
            <label className="block"><span className="text-xs text-muted-foreground">OG Title</span>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.og_title || ""} onChange={e => setEditing({ ...page, og_title: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">OG Description</span>
              <textarea className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" rows={2} value={page.og_description || ""} onChange={e => setEditing({ ...page, og_description: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">OG Image URL</span>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.og_image || ""} onChange={e => setEditing({ ...page, og_image: e.target.value })} />
            </label>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">Twitter Card</p>
            <label className="block"><span className="text-xs text-muted-foreground">Twitter Title</span>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.twitter_title || ""} onChange={e => setEditing({ ...page, twitter_title: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">Twitter Description</span>
              <textarea className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" rows={2} value={page.twitter_description || ""} onChange={e => setEditing({ ...page, twitter_description: e.target.value })} />
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">Twitter Image URL</span>
              <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={page.twitter_image || ""} onChange={e => setEditing({ ...page, twitter_image: e.target.value })} />
            </label>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4">Schema Markup (JSON-LD)</p>
            <textarea className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground font-mono" rows={4} value={JSON.stringify(page.schema_markup_json || {}, null, 2)} onChange={e => { try { setEditing({ ...page, schema_markup_json: JSON.parse(e.target.value) }); } catch {} }} />

            {/* Score Breakdown */}
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-primary font-bold">SEO Score</span>
                <span className="text-lg font-black text-primary">{calcScore(page)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${calcScore(page) >= 80 ? "bg-green-400" : calcScore(page) >= 50 ? "bg-yellow-400" : "bg-destructive"}`} style={{ width: `${calcScore(page)}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <span className={page.meta_title ? "text-green-400" : "text-destructive"}>✓ Meta Title</span>
                <span className={page.meta_description ? "text-green-400" : "text-destructive"}>✓ Description</span>
                <span className={page.canonical_url ? "text-green-400" : "text-destructive"}>✓ Canonical</span>
                <span className={page.og_title ? "text-green-400" : "text-destructive"}>✓ OG Tags</span>
                <span className={page.twitter_title ? "text-green-400" : "text-destructive"}>✓ Twitter Card</span>
                <span className={(page.meta_keywords || []).length > 0 ? "text-green-400" : "text-destructive"}>✓ Keywords</span>
                <span className={page.schema_markup_json && Object.keys(page.schema_markup_json).length > 0 ? "text-green-400" : "text-destructive"}>✓ Schema</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setEditing(null); setCreating(false); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={savePage} disabled={saving || !page.page_url} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl neural-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{pages.length}</p>
          <p className="text-[10px] text-muted-foreground">Total Pages</p>
        </div>
        <div className="glass rounded-xl neural-border p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{brokenCount}</p>
          <p className="text-[10px] text-muted-foreground">Need Fixing</p>
        </div>
        <div className="glass rounded-xl neural-border p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{pages.filter(p => (p.seo_score || 0) >= 80).length}</p>
          <p className="text-[10px] text-muted-foreground">Optimized</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" placeholder="Search pages..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {PAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {brokenCount > 0 && (
          <button onClick={runAutoFix} disabled={autoFixing} className="px-3 py-2 bg-accent text-accent-foreground rounded-lg text-xs font-medium flex items-center gap-1.5">
            {autoFixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} AI Auto-Fix ({brokenCount})
          </button>
        )}
        {bulkSelected.length > 0 && (
          <button onClick={() => setBulkEdit(true)} className="px-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-medium">
            Bulk Edit ({bulkSelected.length})
          </button>
        )}
        <button onClick={() => { setCreating(true); setEditing(emptyPage); }} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> Add Page
        </button>
      </div>

      {bulkEdit && (
        <div className="glass rounded-xl neural-border p-4 flex items-center gap-4">
          <span className="text-xs text-muted-foreground">Bulk update {bulkSelected.length} pages:</span>
          <label className="flex items-center gap-1 text-xs text-foreground"><input type="checkbox" checked={bulkData.robots_index} onChange={e => setBulkData(p => ({ ...p, robots_index: e.target.checked }))} /> Index</label>
          <label className="flex items-center gap-1 text-xs text-foreground"><input type="checkbox" checked={bulkData.robots_follow} onChange={e => setBulkData(p => ({ ...p, robots_follow: e.target.checked }))} /> Follow</label>
          <button onClick={applyBulkEdit} disabled={saving} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">{saving ? "Saving..." : "Apply"}</button>
          <button onClick={() => { setBulkEdit(false); setBulkSelected([]); }} className="text-xs text-muted-foreground">Cancel</button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No SEO pages found. Add your first page.</p>
        ) : filtered.map(page => {
          const score = page.seo_score || 0;
          return (
            <div key={page.id} className="glass rounded-xl neural-border p-4">
              <div className="flex items-center gap-4">
                <input type="checkbox" checked={bulkSelected.includes(page.id)} onChange={e => setBulkSelected(prev => e.target.checked ? [...prev, page.id] : prev.filter(id => id !== page.id))} className="rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{page.page_url}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{page.page_type}</span>
                    {page.robots_index ? <Eye className="w-3 h-3 text-green-400" /> : <EyeOff className="w-3 h-3 text-destructive" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{page.meta_title || "No title"}</p>
                  <div className="flex gap-1 mt-1">
                    {!page.meta_title && <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/15 text-destructive">No Title</span>}
                    {!page.meta_description && <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/15 text-destructive">No Desc</span>}
                    {!page.og_title && <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400">No OG</span>}
                    {!page.canonical_url && <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400">No Canonical</span>}
                    {(!page.schema_markup_json || Object.keys(page.schema_markup_json).length === 0) && <span className="text-[9px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">No Schema</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-10 text-center">
                    <span className={`text-xs font-bold ${score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-destructive"}`}>{score}%</span>
                    <div className="w-full h-1 rounded-full bg-secondary mt-0.5 overflow-hidden">
                      <div className={`h-full rounded-full ${score >= 80 ? "bg-green-400" : score >= 50 ? "bg-yellow-400" : "bg-destructive"}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                  <button onClick={() => setEditing(page)} className="p-1.5 rounded-lg hover:bg-secondary"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  <button onClick={() => deletePage(page.id)} className="p-1.5 rounded-lg hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SEOPageManager;
