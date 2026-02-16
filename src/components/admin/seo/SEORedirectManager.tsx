import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, ArrowRight, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Redirect {
  id: string;
  source_url: string;
  destination_url: string;
  redirect_type: string;
  is_active: boolean;
  created_at: string;
}

const SEORedirectManager = () => {
  const { toast } = useToast();
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ source_url: "", destination_url: "", redirect_type: "301" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRedirects(); }, []);

  const fetchRedirects = async () => {
    setLoading(true);
    const { data } = await supabase.from("seo_redirects").select("*").order("created_at", { ascending: false });
    setRedirects((data || []) as Redirect[]);
    setLoading(false);
  };

  const addRedirect = async () => {
    if (!form.source_url || !form.destination_url) return;
    setSaving(true);
    const { error } = await supabase.from("seo_redirects").insert(form);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Redirect added" }); setForm({ source_url: "", destination_url: "", redirect_type: "301" }); setAdding(false); }
    setSaving(false);
    fetchRedirects();
  };

  const toggleActive = async (r: Redirect) => {
    await supabase.from("seo_redirects").update({ is_active: !r.is_active }).eq("id", r.id);
    fetchRedirects();
  };

  const deleteRedirect = async (id: string) => {
    await supabase.from("seo_redirects").delete().eq("id", id);
    toast({ title: "Deleted" });
    fetchRedirects();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-1.5"><Plus className="w-3 h-3" /> Add Redirect</button>
      </div>

      {adding && (
        <div className="glass rounded-xl neural-border p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="block"><span className="text-xs text-muted-foreground">Source URL *</span>
            <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))} placeholder="/old-page" />
          </label>
          <label className="block"><span className="text-xs text-muted-foreground">Destination URL *</span>
            <input className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={form.destination_url} onChange={e => setForm(f => ({ ...f, destination_url: e.target.value }))} placeholder="/new-page" />
          </label>
          <label className="block"><span className="text-xs text-muted-foreground">Type</span>
            <select className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" value={form.redirect_type} onChange={e => setForm(f => ({ ...f, redirect_type: e.target.value }))}>
              <option value="301">301 (Permanent)</option>
              <option value="302">302 (Temporary)</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button onClick={addRedirect} disabled={saving} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium">{saving ? "..." : "Save"}</button>
            <button onClick={() => setAdding(false)} className="px-3 py-2 text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {redirects.map(r => (
          <div key={r.id} className={`glass rounded-xl neural-border p-3 flex items-center gap-3 ${!r.is_active ? "opacity-50" : ""}`}>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.redirect_type === "301" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>{r.redirect_type}</span>
            <span className="text-sm text-foreground truncate">{r.source_url}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-sm text-primary truncate flex-1">{r.destination_url}</span>
            <button onClick={() => toggleActive(r)} className="p-1.5">
              {r.is_active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
            </button>
            <button onClick={() => deleteRedirect(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
          </div>
        ))}
        {redirects.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No redirects configured</p>}
      </div>
    </div>
  );
};

export default SEORedirectManager;
