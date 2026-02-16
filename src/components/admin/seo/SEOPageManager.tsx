import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Search, Loader2, Save, X, Eye, EyeOff, Sparkles, Zap, Globe, Pencil, Brain, Wand2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
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
  const [autoFixing, setAutoFixing] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  // For new page creation: just URL + type
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState("landing");

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

  // AI generates ALL SEO fields from just URL + type
  const generateWithAI = async (url: string, type: string, existingPage?: SEOPage) => {
    setAiGenerating(true);
    setAiGenerated(false);
    try {
      const res = await supabase.functions.invoke("seo-ai-optimize", {
        body: { action: "generate-page-seo", page_url: url, page_type: type }
      });
      if (res.error) throw res.error;
      const d = res.data;
      if (d?.error) throw new Error(d.error);

      const generated: SEOPage = {
        ...(existingPage || emptyPage),
        page_url: url,
        page_type: type,
        meta_title: d.meta_title || existingPage?.meta_title || "",
        meta_description: d.meta_description || existingPage?.meta_description || "",
        meta_keywords: d.meta_keywords || existingPage?.meta_keywords || [],
        canonical_url: d.canonical_url || existingPage?.canonical_url || url,
        og_title: d.og_title || existingPage?.og_title || "",
        og_description: d.og_description || existingPage?.og_description || "",
        twitter_title: d.twitter_title || existingPage?.twitter_title || "",
        twitter_description: d.twitter_description || existingPage?.twitter_description || "",
        schema_markup_json: d.schema_markup || existingPage?.schema_markup_json || {},
        robots_index: existingPage?.robots_index ?? true,
        robots_follow: existingPage?.robots_follow ?? true,
        og_image: existingPage?.og_image || "",
        twitter_image: existingPage?.twitter_image || "",
      };
      setEditing(generated);
      setAiGenerated(true);
      toast({ title: "🤖 AI Generated", description: "All SEO fields populated. Review & submit!" });
    } catch (e: any) {
      toast({ title: "AI Error", description: e.message || "Failed to generate", variant: "destructive" });
    }
    setAiGenerating(false);
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
      else toast({ title: "✅ Saved successfully" });
    } else {
      const { error } = await supabase.from("seo_pages").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "✅ Created successfully" });
    }
    setSaving(false); setEditing(null); setCreating(false); setAiGenerated(false); setNewUrl(""); fetchPages();
  };

  const deletePage = async (id: string) => {
    await supabase.from("seo_pages").delete().eq("id", id);
    toast({ title: "Deleted" }); fetchPages();
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

  const regenerateExisting = async (page: SEOPage) => {
    await generateWithAI(page.page_url, page.page_type, page);
  };

  const bulkAIGenerate = async () => {
    if (bulkSelected.length === 0) return;
    setAutoFixing(true);
    let count = 0;
    for (const id of bulkSelected) {
      const page = pages.find(p => p.id === id);
      if (!page) continue;
      try {
        const res = await supabase.functions.invoke("seo-ai-optimize", {
          body: { action: "generate-page-seo", page_url: page.page_url, page_type: page.page_type }
        });
        if (res.error) continue;
        const d = res.data;
        if (d?.error) continue;
        const update: any = {
          meta_title: d.meta_title, meta_description: d.meta_description, meta_keywords: d.meta_keywords,
          canonical_url: d.canonical_url || page.page_url, og_title: d.og_title, og_description: d.og_description,
          twitter_title: d.twitter_title, twitter_description: d.twitter_description,
          schema_markup_json: d.schema_markup || {},
        };
        // Recalculate score
        const merged = { ...page, ...update };
        update.seo_score = calcScore(merged as SEOPage);
        await supabase.from("seo_pages").update(update).eq("id", id);
        count++;
      } catch {}
    }
    toast({ title: `🤖 AI Bulk Generated`, description: `Updated ${count}/${bulkSelected.length} pages` });
    setBulkSelected([]);
    setAutoFixing(false);
    fetchPages();
  };

  const filtered = pages.filter(p => {
    const matchSearch = !search || p.page_url.toLowerCase().includes(search.toLowerCase()) || (p.meta_title || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || p.page_type === filterType;
    return matchSearch && matchType;
  });

  const brokenCount = pages.filter(p => !p.meta_title || !p.meta_description || !p.og_title || !p.canonical_url).length;

  const titleQuality = (title: string | null) => {
    if (!title) return { label: "Missing", color: "text-destructive" };
    if (title.length < 20) return { label: "Too Short", color: "text-yellow-400" };
    if (title.length > 60) return { label: "Too Long", color: "text-orange-400" };
    return { label: "Perfect", color: "text-green-400" };
  };

  const descQuality = (desc: string | null) => {
    if (!desc) return { label: "Missing", color: "text-destructive" };
    if (desc.length < 70) return { label: "Too Short", color: "text-yellow-400" };
    if (desc.length > 160) return { label: "Too Long", color: "text-orange-400" };
    return { label: "Perfect", color: "text-green-400" };
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  // ===== AI-FIRST NEW PAGE CREATION =====
  if (creating && !editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> AI Page SEO Generator</h3>
          <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="glass rounded-2xl neural-border p-6 space-y-5">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-primary" />
            </div>
            <h4 className="text-base font-bold text-foreground">Just Enter URL — AI Does The Rest</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">Enter the page URL and select type. AI will automatically generate meta title, description, keywords, OG tags, Twitter cards, schema markup, and canonical URL.</p>
          </div>

          <div className="max-w-lg mx-auto space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Page URL *</span>
              <input
                className="w-full mt-1 px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                placeholder="/pricing, /community/upsc, /about..."
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Page Type</span>
              <select
                className="w-full mt-1 px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:outline-none"
                value={newType}
                onChange={e => setNewType(e.target.value)}
              >
                {PAGE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </label>
            <button
              onClick={() => generateWithAI(newUrl, newType)}
              disabled={!newUrl || aiGenerating}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all shadow-lg shadow-primary/25"
            >
              {aiGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> AI is Generating SEO...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate with AI & Submit</>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== AI-GENERATED REVIEW & SUBMIT =====
  if (editing) {
    const page = editing;
    const tq = titleQuality(page.meta_title);
    const dq = descQuality(page.meta_description);
    const score = calcScore(page);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            {aiGenerated && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {aiGenerated ? "AI Generated — Review & Submit" : "Edit Page SEO"}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => regenerateExisting(page)}
              disabled={aiGenerating}
              className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-90"
            >
              {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {aiGenerating ? "Regenerating..." : "🤖 Regenerate AI"}
            </button>
            <button onClick={() => { setEditing(null); setCreating(false); setAiGenerated(false); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {aiGenerated && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <Sparkles className="w-4 h-4 text-green-400 shrink-0" />
            <p className="text-xs text-green-300">All fields AI-generated. You can tweak any field or just click <strong>Submit</strong>.</p>
          </div>
        )}

        {/* SERP Preview */}
        <div className="glass rounded-xl neural-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Globe className="w-3 h-3" /> Google SERP Preview</span>
            <span className={`text-xs font-bold ${score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-destructive"}`}>Score: {score}%</span>
          </div>
          <div className="bg-background rounded-lg p-3 border border-border">
            <p className="text-blue-400 text-base font-medium truncate">{page.meta_title || "Page Title — ACRY"}</p>
            <p className="text-green-500 text-xs mt-0.5">brain-boost-ai-12.lovable.app{page.page_url}</p>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{page.meta_description || "Add a meta description..."}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-3">
            <label className="block"><span className="text-xs text-muted-foreground">Page URL</span>
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
            <label className="block"><span className="text-xs text-muted-foreground">Meta Keywords</span>
              <div className="flex flex-wrap gap-1 mt-1 p-2 rounded-lg bg-secondary border border-border min-h-[40px]">
                {(page.meta_keywords || []).map((k, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[11px] font-medium">
                    {k}
                    <button onClick={() => setEditing({ ...page, meta_keywords: (page.meta_keywords || []).filter((_, j) => j !== i) })} className="hover:text-destructive">×</button>
                  </span>
                ))}
              </div>
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

          {/* Right Column */}
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
                <span className="text-lg font-black text-primary">{score}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${score >= 80 ? "bg-green-400" : score >= 50 ? "bg-yellow-400" : "bg-destructive"}`} style={{ width: `${score}%` }} />
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
          <button onClick={() => { setEditing(null); setCreating(false); setAiGenerated(false); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={savePage} disabled={saving || !page.page_url} className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/25 hover:opacity-90">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Submit
          </button>
        </div>
      </div>
    );
  }

  // ===== PAGE LIST =====
  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
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
        <div className="glass rounded-xl neural-border p-3 text-center">
          <p className="text-2xl font-bold text-primary">{Math.round(pages.reduce((a, p) => a + (p.seo_score || 0), 0) / (pages.length || 1))}%</p>
          <p className="text-[10px] text-muted-foreground">Avg Score</p>
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
          <button onClick={bulkAIGenerate} disabled={autoFixing} className="px-3 py-2 bg-accent text-accent-foreground rounded-lg text-xs font-medium flex items-center gap-1.5">
            {autoFixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />} AI Regenerate ({bulkSelected.length})
          </button>
        )}
        <button onClick={() => setCreating(true)} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> AI Add Page
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">No SEO pages yet. Click <strong>"AI Add Page"</strong> to get started.</p>
          </div>
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
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-10 text-center">
                    <span className={`text-xs font-bold ${score >= 80 ? "text-green-400" : score >= 50 ? "text-yellow-400" : "text-destructive"}`}>{score}%</span>
                    <div className="w-full h-1 rounded-full bg-secondary mt-0.5 overflow-hidden">
                      <div className={`h-full rounded-full ${score >= 80 ? "bg-green-400" : score >= 50 ? "bg-yellow-400" : "bg-destructive"}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                  <button onClick={() => regenerateExisting(page)} title="AI Regenerate" className="p-1.5 rounded-lg hover:bg-primary/10"><RefreshCw className="w-3.5 h-3.5 text-primary" /></button>
                  <button onClick={() => { setEditing(page); setAiGenerated(false); }} className="p-1.5 rounded-lg hover:bg-secondary"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
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
