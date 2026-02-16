import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Check, X, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Suggestion {
  id: string;
  page_id: string | null;
  page_url: string;
  suggested_meta_title: string | null;
  suggested_meta_description: string | null;
  suggested_keywords: string[] | null;
  suggested_schema: any;
  status: string;
  created_at: string;
}

const SEOAISuggestions = () => {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState("pending");

  useEffect(() => { fetchSuggestions(); }, [filter]);

  const fetchSuggestions = async () => {
    setLoading(true);
    let q = supabase.from("seo_ai_suggestions").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setSuggestions((data || []) as Suggestion[]);
    setLoading(false);
  };

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("seo-ai-optimize", { body: {} });
      if (res.error) throw res.error;
      toast({ title: "AI suggestions generated", description: `${res.data?.count || 0} new suggestions` });
      fetchSuggestions();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate", variant: "destructive" });
    }
    setGenerating(false);
  };

  const acceptSuggestion = async (s: Suggestion) => {
    // Apply to seo_pages
    if (s.page_id) {
      const update: any = {};
      if (s.suggested_meta_title) update.meta_title = s.suggested_meta_title;
      if (s.suggested_meta_description) update.meta_description = s.suggested_meta_description;
      if (s.suggested_keywords && s.suggested_keywords.length) update.meta_keywords = s.suggested_keywords;
      if (s.suggested_schema) update.schema_markup_json = s.suggested_schema;
      await supabase.from("seo_pages").update(update).eq("id", s.page_id);
    }
    await supabase.from("seo_ai_suggestions").update({ status: "accepted" }).eq("id", s.id);
    toast({ title: "Accepted & applied" });
    fetchSuggestions();
  };

  const rejectSuggestion = async (id: string) => {
    await supabase.from("seo_ai_suggestions").update({ status: "rejected" }).eq("id", id);
    toast({ title: "Rejected" });
    fetchSuggestions();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {["pending", "accepted", "rejected", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={generateSuggestions} disabled={generating} className="px-3 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium flex items-center gap-1.5">
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Generate AI Suggestions
        </button>
      </div>

      <div className="space-y-3">
        {suggestions.map(s => (
          <div key={s.id} className="glass rounded-xl neural-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">{s.page_url}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : s.status === "accepted" ? "bg-green-500/15 text-green-400" : "bg-destructive/15 text-destructive"}`}>
                {s.status}
              </span>
            </div>
            {s.suggested_meta_title && (
              <div><span className="text-[10px] text-muted-foreground">Title:</span><p className="text-sm text-foreground">{s.suggested_meta_title}</p></div>
            )}
            {s.suggested_meta_description && (
              <div><span className="text-[10px] text-muted-foreground">Description:</span><p className="text-xs text-foreground">{s.suggested_meta_description}</p></div>
            )}
            {s.suggested_keywords && s.suggested_keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.suggested_keywords.map((k, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{k}</span>
                ))}
              </div>
            )}
            {s.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => acceptSuggestion(s)} className="px-3 py-1.5 bg-green-500/15 text-green-400 rounded-lg text-xs font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Accept</button>
                <button onClick={() => rejectSuggestion(s.id)} className="px-3 py-1.5 bg-destructive/15 text-destructive rounded-lg text-xs font-medium flex items-center gap-1"><X className="w-3 h-3" /> Reject</button>
              </div>
            )}
          </div>
        ))}
        {suggestions.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No suggestions. Click "Generate AI Suggestions" to get started.</p>}
      </div>
    </div>
  );
};

export default SEOAISuggestions;
