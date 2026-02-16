import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Loader2, Map, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SitemapEntry {
  id: string;
  page_url: string;
  last_modified: string;
  priority: number;
  change_frequency: string;
}

const FREQUENCIES = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];

const SEOSitemapManager = () => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<SitemapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase.from("seo_sitemap").select("*").order("priority", { ascending: false });
    setEntries((data || []) as SitemapEntry[]);
    setLoading(false);
  };

  const regenerateSitemap = async () => {
    setRegenerating(true);
    // Gather all known pages: landing, communities, seo_pages
    const [seoPages, communities] = await Promise.all([
      supabase.from("seo_pages").select("page_url, page_type"),
      supabase.from("communities").select("slug").eq("is_active", true).eq("is_approved", true),
    ]);

    const urlMap: Record<string, { priority: number; freq: string }> = {};
    urlMap["/"] = { priority: 1.0, freq: "daily" };
    urlMap["/auth"] = { priority: 0.5, freq: "monthly" };

    for (const p of seoPages.data || []) {
      urlMap[p.page_url] = { priority: p.page_type === "landing" ? 0.9 : 0.7, freq: "weekly" };
    }
    for (const c of communities.data || []) {
      urlMap[`/community/${c.slug}`] = { priority: 0.6, freq: "daily" };
    }

    // Clear and re-insert
    await supabase.from("seo_sitemap").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const rows = Object.entries(urlMap).map(([url, meta]) => ({
      page_url: url,
      priority: meta.priority,
      change_frequency: meta.freq,
      last_modified: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      await supabase.from("seo_sitemap").insert(rows);
    }

    toast({ title: "Sitemap regenerated", description: `${rows.length} entries` });
    setRegenerating(false);
    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("seo_sitemap").delete().eq("id", id);
    fetchEntries();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{entries.length} sitemap entries</span>
        </div>
        <button onClick={regenerateSitemap} disabled={regenerating} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1.5">
          {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate
        </button>
      </div>

      <div className="space-y-2">
        {entries.map(e => (
          <div key={e.id} className="glass rounded-xl neural-border p-3 flex items-center gap-4">
            <span className="text-sm text-foreground flex-1 truncate">{e.page_url}</span>
            <span className="text-xs text-muted-foreground">{e.change_frequency}</span>
            <span className="text-xs font-mono text-primary">{e.priority}</span>
            <button onClick={() => deleteEntry(e.id)} className="p-1.5 rounded-lg hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No sitemap entries. Click Regenerate to auto-populate.</p>}
      </div>
    </div>
  );
};

export default SEOSitemapManager;
