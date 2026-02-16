import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Check, X, Loader2, RefreshCw, Zap, Brain, Filter, TrendingUp, Target, Wand2 } from "lucide-react";
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
  const [autoFixing, setAutoFixing] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [acceptingAll, setAcceptingAll] = useState(false);

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
      const res = await supabase.functions.invoke("seo-ai-optimize", { body: { action: "optimize" } });
      if (res.error) throw res.error;
      toast({ title: "AI Optimization Complete", description: `${res.data?.count || 0} new suggestions generated` });
      fetchSuggestions();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate", variant: "destructive" });
    }
    setGenerating(false);
  };

  const autoFixAll = async () => {
    setAutoFixing(true);
    try {
      const res = await supabase.functions.invoke("seo-ai-optimize", { body: { action: "auto-fix" } });
      if (res.error) throw res.error;
      toast({ title: "Auto-Fix Complete", description: `Fixed ${res.data?.fixed || 0} pages with missing SEO data` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setAutoFixing(false);
  };

  const acceptSuggestion = async (s: Suggestion) => {
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

  const acceptAllPending = async () => {
    setAcceptingAll(true);
    const pending = suggestions.filter(s => s.status === "pending");
    for (const s of pending) {
      if (s.page_id) {
        const update: any = {};
        if (s.suggested_meta_title) update.meta_title = s.suggested_meta_title;
        if (s.suggested_meta_description) update.meta_description = s.suggested_meta_description;
        if (s.suggested_keywords && s.suggested_keywords.length) update.meta_keywords = s.suggested_keywords;
        if (s.suggested_schema) update.schema_markup_json = s.suggested_schema;
        if (Object.keys(update).length > 0) {
          await supabase.from("seo_pages").update(update).eq("id", s.page_id);
        }
      }
      await supabase.from("seo_ai_suggestions").update({ status: "accepted" }).eq("id", s.id);
    }
    toast({ title: `Accepted all ${pending.length} suggestions` });
    setAcceptingAll(false);
    fetchSuggestions();
  };

  const pendingCount = suggestions.filter(s => s.status === "pending").length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* AI Actions Panel */}
      <div className="glass rounded-2xl neural-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">AI SEO Automation Center</h3>
        </div>
        <p className="text-xs text-muted-foreground">AI analyzes all your pages and generates CTR-optimized titles, compelling descriptions, high-intent keywords, and schema recommendations to rank faster on Google.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button onClick={generateSuggestions} disabled={generating} className="p-3 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors text-left">
            <div className="flex items-center gap-2 mb-1">
              {generating ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Sparkles className="w-4 h-4 text-primary" />}
              <span className="text-xs font-bold text-foreground">Generate Suggestions</span>
            </div>
            <p className="text-[10px] text-muted-foreground">AI analyzes low-score pages and generates optimized SEO</p>
          </button>
          <button onClick={autoFixAll} disabled={autoFixing} className="p-3 rounded-xl bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-colors text-left">
            <div className="flex items-center gap-2 mb-1">
              {autoFixing ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Zap className="w-4 h-4 text-accent" />}
              <span className="text-xs font-bold text-foreground">Auto-Fix All Pages</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Instantly fill missing meta, OG, and canonical data</p>
          </button>
          {pendingCount > 0 && (
            <button onClick={acceptAllPending} disabled={acceptingAll} className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors text-left">
              <div className="flex items-center gap-2 mb-1">
                {acceptingAll ? <Loader2 className="w-4 h-4 animate-spin text-green-400" /> : <Check className="w-4 h-4 text-green-400" />}
                <span className="text-xs font-bold text-foreground">Accept All ({pendingCount})</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Apply all pending AI suggestions at once</p>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {["pending", "accepted", "rejected", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-[10px]">{pendingCount}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-3">
        {suggestions.map(s => (
          <div key={s.id} className="glass rounded-xl neural-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary">{s.page_url}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : s.status === "accepted" ? "bg-green-500/15 text-green-400" : "bg-destructive/15 text-destructive"}`}>
                {s.status}
              </span>
            </div>

            {s.suggested_meta_title && (
              <div className="p-2 rounded-lg bg-secondary/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Title</span>
                <p className="text-sm text-foreground font-medium">{s.suggested_meta_title}</p>
                <span className={`text-[10px] ${(s.suggested_meta_title || "").length <= 60 ? "text-green-400" : "text-destructive"}`}>{(s.suggested_meta_title || "").length}/60 chars</span>
              </div>
            )}

            {s.suggested_meta_description && (
              <div className="p-2 rounded-lg bg-secondary/30">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Description</span>
                <p className="text-xs text-foreground">{s.suggested_meta_description}</p>
                <span className={`text-[10px] ${(s.suggested_meta_description || "").length <= 160 ? "text-green-400" : "text-destructive"}`}>{(s.suggested_meta_description || "").length}/160 chars</span>
              </div>
            )}

            {s.suggested_keywords && s.suggested_keywords.length > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Keywords</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.suggested_keywords.map((k, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{k}</span>
                  ))}
                </div>
              </div>
            )}

            {s.suggested_schema && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Recommended Schema</span>
                <span className="text-xs text-accent ml-2">{typeof s.suggested_schema === 'object' ? s.suggested_schema["@type"] || JSON.stringify(s.suggested_schema) : s.suggested_schema}</span>
              </div>
            )}

            {/* SERP Preview */}
            {s.suggested_meta_title && (
              <div className="p-3 rounded-lg bg-background border border-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Google Preview</span>
                <p className="text-blue-400 text-sm font-medium truncate">{s.suggested_meta_title}</p>
                <p className="text-green-500 text-[11px]">brain-boost-ai-12.lovable.app{s.page_url}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.suggested_meta_description || ""}</p>
              </div>
            )}

            {s.status === "pending" && (
              <div className="flex gap-2 pt-1">
                <button onClick={() => acceptSuggestion(s)} className="px-3 py-1.5 bg-green-500/15 text-green-400 rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-green-500/25 transition-colors"><Check className="w-3 h-3" /> Accept & Apply</button>
                <button onClick={() => rejectSuggestion(s.id)} className="px-3 py-1.5 bg-destructive/15 text-destructive rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-destructive/25 transition-colors"><X className="w-3 h-3" /> Reject</button>
              </div>
            )}
          </div>
        ))}
        {suggestions.length === 0 && (
          <div className="text-center py-10">
            <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No suggestions yet. Click "Generate Suggestions" to let AI optimize your SEO.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SEOAISuggestions;
