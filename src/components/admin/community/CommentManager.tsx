import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Trash2, Loader2, RefreshCw, Search, Pencil, Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  is_deleted: boolean;
  is_ai_answer: boolean;
  upvote_count: number;
  created_at: string;
  post_title?: string;
}

const CommentManager = () => {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "deleted" | "ai">("active");
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchComments = async () => {
    setLoading(true);
    let q = (supabase as any).from("post_comments").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "active") q = q.eq("is_deleted", false);
    else if (filter === "deleted") q = q.eq("is_deleted", true);
    else if (filter === "ai") q = q.eq("is_ai_answer", true);

    const { data: commentsData } = await q;
    const postIdSet = new Set<string>();
    (commentsData || []).forEach((c: any) => postIdSet.add(String(c.post_id)));
    const postIds = Array.from(postIdSet);
    
    let postTitles: Record<string, string> = {};
    if (postIds.length > 0) {
      const { data: postsData } = await supabase.from("community_posts").select("id, title").in("id", postIds.slice(0, 100));
      (postsData || []).forEach((p: any) => { postTitles[p.id] = p.title; });
    }

    setComments((commentsData || []).map((c: any) => ({
      ...c,
      post_title: postTitles[c.post_id] || "Unknown post",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchComments(); }, [filter]);

  const filtered = comments.filter(c =>
    c.content.toLowerCase().includes(search.toLowerCase()) ||
    (c.post_title || "").toLowerCase().includes(search.toLowerCase())
  );

  const deleteComment = async (id: string) => {
    await (supabase as any).from("post_comments").update({ is_deleted: true }).eq("id", id);
    toast({ title: "Comment deleted" });
    fetchComments();
  };

  const restoreComment = async (id: string) => {
    await (supabase as any).from("post_comments").update({ is_deleted: false }).eq("id", id);
    toast({ title: "Comment restored ✅" });
    fetchComments();
  };

  const saveEdit = async (id: string) => {
    await (supabase as any).from("post_comments").update({ content: editContent }).eq("id", id);
    setEditId(null);
    toast({ title: "Comment updated ✅" });
    fetchComments();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Comment Management</h3>
        <button onClick={fetchComments} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search comments..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
        </div>
      </div>
      <div className="flex gap-2">
        {(["active", "deleted", "ai"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {f === "ai" ? "AI Answers" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No comments found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="glass rounded-xl p-3 neural-border">
              {editId === c.id ? (
                <div className="space-y-2">
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" rows={3} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(c.id)} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs">Save</button>
                    <button onClick={() => setEditId(null)} className="px-3 py-1 rounded-lg bg-secondary text-muted-foreground text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{c.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[10px] text-muted-foreground">
                        on "{c.post_title}" • ↑{c.upvote_count} • {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                      {c.is_ai_answer && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">AI Answer</span>}
                      {c.is_deleted && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">Deleted</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditId(c.id); setEditContent(c.content); }} className="p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {c.is_deleted ? (
                      <button onClick={() => restoreComment(c.id)} className="p-1.5 bg-success/10 text-success rounded-lg hover:bg-success/20 text-xs" title="Restore">↩</button>
                    ) : (
                      <button onClick={() => deleteComment(c.id)} className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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

export default CommentManager;
