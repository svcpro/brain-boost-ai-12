import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Check, X, Trash2, Loader2, RefreshCw, Search,
  Plus, Pencil, ToggleLeft, ToggleRight, Shield, Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Community {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  category: string;
  exam_type: string | null;
  subject: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_by: string;
  member_count: number;
  post_count: number;
  created_at: string;
  weekly_active_users: number | null;
}

const CommunityListManager = () => {
  const { toast } = useToast();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "disabled">("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newSlug, setNewSlug] = useState("");

  const fetchCommunities = async () => {
    setLoading(true);
    let q = supabase.from("communities").select("*").order("created_at", { ascending: false });
    if (filter === "pending") q = q.eq("is_approved", false);
    else if (filter === "active") q = q.eq("is_approved", true).eq("is_active", true);
    else if (filter === "disabled") q = q.eq("is_active", false);
    const { data } = await q;
    setCommunities((data as Community[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCommunities(); }, [filter]);

  const filtered = communities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase()) ||
    (c.subject || "").toLowerCase().includes(search.toLowerCase())
  );

  const approve = async (id: string) => {
    await supabase.from("communities").update({ is_approved: true }).eq("id", id);
    toast({ title: "Community approved ✅" });
    fetchCommunities();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("communities").update({ is_active: !active }).eq("id", id);
    toast({ title: active ? "Community disabled" : "Community enabled ✅" });
    fetchCommunities();
  };

  const deleteCommunity = async (id: string) => {
    if (!confirm("Delete this community and all its posts?")) return;
    await supabase.from("communities").delete().eq("id", id);
    toast({ title: "Community deleted" });
    fetchCommunities();
  };

  const saveEdit = async (id: string) => {
    await supabase.from("communities").update({ name: editName, description: editDesc }).eq("id", id);
    setEditId(null);
    toast({ title: "Community updated ✅" });
    fetchCommunities();
  };

  const createCommunity = async () => {
    if (!newName.trim()) return;
    const slug = newSlug.trim() || newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { error } = await supabase.from("communities").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      slug,
      category: newCategory,
      created_by: (await supabase.auth.getUser()).data.user?.id || "",
      is_approved: true,
      is_active: true,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Community created ✅" });
    setShowCreate(false);
    setNewName(""); setNewDesc(""); setNewSlug("");
    fetchCommunities();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Communities</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(!showCreate)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
          <button onClick={fetchCommunities} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="glass rounded-xl p-4 neural-border space-y-3">
          <h4 className="text-sm font-semibold text-foreground">New Community</h4>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Community name" className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
          <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="Slug (auto-generated)" className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description" className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" rows={2} />
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground">
            <option value="general">General</option>
            <option value="exam_prep">Exam Prep</option>
            <option value="subject">Subject</option>
            <option value="study_group">Study Group</option>
          </select>
          <div className="flex gap-2">
            <button onClick={createCommunity} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Create</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-xs font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search communities..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
        </div>
        {(["all", "pending", "active", "disabled"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No communities found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="glass rounded-xl p-4 neural-border">
              {editId === c.id ? (
                <div className="space-y-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(c.id)} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs">Save</button>
                    <button onClick={() => setEditId(null)} className="px-3 py-1 rounded-lg bg-secondary text-muted-foreground text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      {!c.is_approved && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">Pending</span>}
                      {!c.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">Disabled</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {c.category} {c.subject ? `• ${c.subject}` : ""} • {c.member_count} members • {c.post_count} posts • {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </p>
                    {c.description && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{c.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!c.is_approved && (
                      <button onClick={() => approve(c.id)} className="p-1.5 bg-success/10 text-success rounded-lg hover:bg-success/20" title="Approve">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => { setEditId(c.id); setEditName(c.name); setEditDesc(c.description || ""); }} className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(c.id, c.is_active)} className="p-1.5 bg-secondary text-muted-foreground rounded-lg hover:bg-secondary/80" title={c.is_active ? "Disable" : "Enable"}>
                      {c.is_active ? <ToggleRight className="w-3.5 h-3.5 text-success" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteCommunity(c.id)} className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunityListManager;
