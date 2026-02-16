import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Trash2, Loader2, RefreshCw, Search,
  Pencil, Eye, Pin, Star, AlertTriangle, Filter
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Post {
  id: string;
  title: string;
  content: string;
  post_type: string;
  community_id: string;
  user_id: string;
  is_pinned: boolean;
  is_deleted: boolean;
  upvote_count: number;
  comment_count: number;
  view_count: number;
  importance_score: number | null;
  importance_level: string | null;
  ai_quality_score: number | null;
  created_at: string;
  community_name?: string;
}

const PostManager = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCommunity, setFilterCommunity] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"active" | "deleted" | "pinned" | "flagged">("active");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [commRes, _] = await Promise.all([
      supabase.from("communities").select("id, name").eq("is_approved", true),
      null,
    ]);
    setCommunities(commRes.data || []);

    let q = supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(200);
    if (filterStatus === "active") q = q.eq("is_deleted", false);
    else if (filterStatus === "deleted") q = q.eq("is_deleted", true);
    else if (filterStatus === "pinned") q = q.eq("is_pinned", true).eq("is_deleted", false);
    else if (filterStatus === "flagged") q = q.not("importance_level", "is", null).eq("is_deleted", false);

    if (filterCommunity !== "all") q = q.eq("community_id", filterCommunity);

    const { data } = await q;
    const postsWithNames = (data || []).map((p: any) => ({
      ...p,
      community_name: (commRes.data || []).find((c: any) => c.id === p.community_id)?.name || "Unknown",
    }));
    setPosts(postsWithNames);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterStatus, filterCommunity]);

  const filtered = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.content.toLowerCase().includes(search.toLowerCase())
  );

  const deletePost = async (id: string) => {
    await supabase.from("community_posts").update({ is_deleted: true }).eq("id", id);
    toast({ title: "Post deleted" });
    fetchData();
  };

  const restorePost = async (id: string) => {
    await supabase.from("community_posts").update({ is_deleted: false }).eq("id", id);
    toast({ title: "Post restored ✅" });
    fetchData();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("community_posts").update({ is_pinned: !pinned }).eq("id", id);
    toast({ title: pinned ? "Unpinned" : "Pinned 📌" });
    fetchData();
  };

  const saveEdit = async (id: string) => {
    await supabase.from("community_posts").update({ title: editTitle, content: editContent }).eq("id", id);
    setEditId(null);
    toast({ title: "Post updated ✅" });
    fetchData();
  };

  const getImportanceColor = (level: string | null) => {
    if (!level) return "";
    if (level === "critical") return "bg-destructive/15 text-destructive";
    if (level === "important") return "bg-warning/15 text-warning";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Post Management</h3>
        <button onClick={fetchData} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
        </div>
        <select value={filterCommunity} onChange={e => setFilterCommunity(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-foreground">
          <option value="all">All Communities</option>
          {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        {(["active", "deleted", "pinned", "flagged"] as const).map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f === "active" && `(${posts.length})`}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No posts found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="glass rounded-xl p-3 neural-border">
              {editId === p.id ? (
                <div className="space-y-2">
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" rows={3} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(p.id)} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs">Save</button>
                    <button onClick={() => setEditId(null)} className="px-3 py-1 rounded-lg bg-secondary text-muted-foreground text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                          {p.title}
                        </p>
                        {p.is_pinned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">📌 Pinned</span>}
                        {p.is_deleted && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">Deleted</span>}
                        {p.importance_level && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getImportanceColor(p.importance_level)}`}>
                            {p.importance_level}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {p.community_name} • {p.post_type} • ↑{p.upvote_count} • 💬{p.comment_count} • 👁{p.view_count}
                        {p.ai_quality_score != null && ` • Quality: ${p.ai_quality_score}`}
                        {' '}• {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => togglePin(p.id, p.is_pinned)} className={`p-1.5 rounded-lg text-xs ${p.is_pinned ? "bg-warning/15 text-warning" : "bg-secondary/50 text-muted-foreground"}`} title="Pin">
                        📌
                      </button>
                      <button onClick={() => { setEditId(p.id); setEditTitle(p.title); setEditContent(p.content); }} className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {p.is_deleted ? (
                        <button onClick={() => restorePost(p.id)} className="p-1.5 bg-success/10 text-success rounded-lg hover:bg-success/20 text-xs" title="Restore">↩</button>
                      ) : (
                        <button onClick={() => deletePost(p.id)} className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedId === p.id && (
                    <div className="mt-2 p-3 rounded-lg bg-secondary/30 text-xs text-foreground/80 whitespace-pre-wrap">
                      {p.content}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostManager;
