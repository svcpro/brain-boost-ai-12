import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Search, Loader2, Save, X } from "lucide-react";
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
    setSaving(false);
    fetchKeywords();
  };

  const deleteKeyword = async (id: string) => {
    await supabase.from("seo_keywords").delete().eq("id", id);
    toast({ title: "Deleted" });
    fetchKeywords();
  };

  const filtered = keywords.filter(k => !search || k.keyword.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" placeholder="Search keywords..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
              <span className="text-sm font-medium text-foreground">{k.keyword}</span>
              {k.target_url && <span className="text-xs text-muted-foreground ml-2">→ {k.target_url}</span>}
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
