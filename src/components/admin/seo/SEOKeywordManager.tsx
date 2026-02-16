import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Search, Loader2, Sparkles, TrendingUp, Target, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Keyword {
  id: string;
  keyword: string;
  search_volume: number | null;
  priority: string;
  target_url: string | null;
  created_at: string;
}

const PRIORITIES = ["high", "medium", "low"];

const SEOKeywordManager = () => {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ keyword: "", search_volume: 0, priority: "medium", target_url: "" });
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);
  const [aiKeywords, setAiKeywords] = useState<any[]>([]);
  const [researchTopic, setResearchTopic] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortBy, setSortBy] = useState<"created_at" | "search_volume" | "priority">("created_at");

  useEffect(() => { fetchKeywords(); }, []);

  const fetchKeywords = async () => {
    setLoading(true);
    const { data } = await supabase.from("seo_keywords").select("*").order("created_at", { ascending: false });
    setKeywords((data || []) as Keyword[]);
    setLoading(false);
  };

  const addKeyword = async () => {
    if (!form.keyword) return;
    setSaving(true);
    const { error } = await supabase.from("seo_keywords").insert({ keyword: form.keyword, search_volume: form.search_volume, priority: form.priority, target_url: form.target_url || null });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Keyword added" }); setForm({ keyword: "", search_volume: 0, priority: "medium", target_url: "" }); setAdding(false); }
    setSaving(false); fetchKeywords();
  };

  const deleteKeyword = async (id: string) => {
    await supabase.from("seo_keywords").delete().eq("id", id);
    toast({ title: "Deleted" }); fetchKeywords();
  };

  const runAIKeywordResearch = async () => {
    if (!researchTopic.trim()) { toast({ title: "Enter a topic", variant: "destructive" }); return; }
    setResearching(true);
    try {
      const res = await supabase.functions.invoke("seo-ai-optimize", {
        body: { action: "keywords", topic: researchTopic, target_url: "/" },
      });
      if (res.error) throw res.error;
      setAiKeywords(res.data?.keywords || []);
      toast({ title: "AI Research Complete", description: `Found ${res.data?.keywords?.length || 0} keywords` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setResearching(false);
  };

  const addAIKeyword = async (k: any) => {
    const { error } = await supabase.from("seo_keywords").insert({
      keyword: k.keyword,
      search_volume: 0,
      priority: k.priority || "medium",
      target_url: k.suggested_url || null,
    });
    if (!error) {
      toast({ title: `Added: ${k.keyword}` });
      setAiKeywords(prev => prev.filter(x => x.keyword !== k.keyword));
      fetchKeywords();
    }
  };

  const addAllAIKeywords = async () => {
    setSaving(true);
    const rows = aiKeywords.map(k => ({
      keyword: k.keyword,
      search_volume: 0,
      priority: k.priority || "medium",
      target_url: k.suggested_url || null,
    }));
    if (rows.length > 0) {
      await supabase.from("seo_keywords").insert(rows);
      toast({ title: `Added ${rows.length} keywords` });
      setAiKeywords([]);
      fetchKeywords();
    }
    setSaving(false);
  };

  const filtered = keywords.filter(k => {
    const matchSearch = !search || k.keyword.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === "all" || k.priority === filterPriority;
    return matchSearch && matchPriority;
  }).sort((a, b) => {
    if (sortBy === "search_volume") return (b.search_volume || 0) - (a.search_volume || 0);
    if (sortBy === "priority") {
      const order = { high: 3, medium: 2, low: 1 };
      return (order[b.priority as keyof typeof order] || 0) - (order[a.priority as keyof typeof order] || 0);
    }
    return 0;
  });

  const unmappedCount = keywords.filter(k => !k.target_url).length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* AI Keyword Research */}
      <div className="glass rounded-2xl neural-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-foreground">AI Keyword Research</h3>
        </div>
        <p className="text-xs text-muted-foreground">Enter a topic and AI will generate high-intent, low-competition keywords optimized for Google India ranking.</p>
        <div className="flex gap-2">
          <input className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" placeholder="e.g. UPSC exam preparation, SSC CGL tips..." value={researchTopic} onChange={e => setResearchTopic(e.target.value)} />
          <button onClick={runAIKeywordResearch} disabled={researching} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium flex items-center gap-1.5 shrink-0">
            {researching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />} Research
          </button>
        </div>

        {aiKeywords.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">AI Suggested Keywords ({aiKeywords.length})</span>
              <button onClick={addAllAIKeywords} disabled={saving} className="px-2 py-1 bg-primary text-primary-foreground rounded text-[10px] font-medium">Add All</button>
            </div>
            {aiKeywords.map((k, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{k.keyword}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${k.difficulty === "easy" ? "bg-green-500/15 text-green-400" : k.difficulty === "medium" ? "bg-yellow-500/15 text-yellow-400" : "bg-destructive/15 text-destructive"}`}>{k.difficulty}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{k.intent}</span>
                  </div>
                  {k.suggested_url && <span className="text-[10px] text-primary">→ {k.suggested_url}</span>}
                </div>
                <button onClick={() => addAIKeyword(k)} className="px-2 py-1 bg-primary/15 text-primary rounded text-xs font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl neural-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{keywords.length}</p>
          <p className="text-[10px] text-muted-foreground">Total Keywords</p>
        </div>
        <div className="glass rounded-xl neural-border p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{keywords.filter(k => k.priority === "high").length}</p>
          <p className="text-[10px] text-muted-foreground">High Priority</p>
        </div>
        <div className="glass rounded-xl neural-border p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{unmappedCount}</p>
          <p className="text-[10px] text-muted-foreground">Unmapped</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" placeholder="Search keywords..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All Priority</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="created_at">Newest</option>
          <option value="search_volume">Volume</option>
          <option value="priority">Priority</option>
        </select>
        <button onClick={() => setAdding(true)} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1.5"><Plus className="w-3 h-3" /> Add</button>
      </div>

      {adding && (
        <div className="glass rounded-xl neural-border p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <label className="block"><span className="text-xs text-muted-foreground">Keyword *</span>
            <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
          </label>
          <label className="block"><span className="text-xs text-muted-foreground">Volume</span>
            <input type="number" className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={form.search_volume} onChange={e => setForm(f => ({ ...f, search_volume: parseInt(e.target.value) || 0 }))} />
          </label>
          <label className="block"><span className="text-xs text-muted-foreground">Priority</span>
            <select className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block"><span className="text-xs text-muted-foreground">Target URL</span>
            <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={form.target_url} onChange={e => setForm(f => ({ ...f, target_url: e.target.value }))} />
          </label>
          <div className="flex gap-2">
            <button onClick={addKeyword} disabled={saving} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium">{saving ? "..." : "Save"}</button>
            <button onClick={() => setAdding(false)} className="px-3 py-2 text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(k => (
          <div key={k.id} className="glass rounded-xl neural-border p-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{k.keyword}</span>
                {k.target_url && (
                  <span className="text-[10px] text-primary flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> {k.target_url}
                  </span>
                )}
                {!k.target_url && <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/15 text-yellow-400">unmapped</span>}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{k.search_volume || 0} vol</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${k.priority === "high" ? "bg-destructive/15 text-destructive" : k.priority === "medium" ? "bg-yellow-500/15 text-yellow-400" : "bg-secondary text-muted-foreground"}`}>{k.priority}</span>
            <button onClick={() => deleteKeyword(k.id)} className="p-1.5 rounded-lg hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No keywords found</p>}
      </div>
    </div>
  );
};

export default SEOKeywordManager;
