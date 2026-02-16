import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Check, X, Trash2, Loader2, MessageSquare,
  Shield, Eye, Search, RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CommunityManagement = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "active" | "posts">("pending");
  const [communities, setCommunities] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    if (tab === "posts") {
      const { data } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false }).limit(100);
      setPosts(data || []);
    } else {
      const isApproved = tab === "active";
      const { data } = await supabase.from("communities").select("*").eq("is_approved", isApproved).order("created_at", { ascending: false });
      setCommunities(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [tab]);

  const approveCommunity = async (id: string) => {
    await supabase.from("communities").update({ is_approved: true }).eq("id", id);
    toast({ title: "Community approved ✅" });
    fetchData();
  };

  const deleteCommunity = async (id: string) => {
    await supabase.from("communities").delete().eq("id", id);
    toast({ title: "Community deleted" });
    fetchData();
  };

  const deletePost = async (id: string) => {
    await supabase.from("community_posts").update({ is_deleted: true }).eq("id", id);
    toast({ title: "Post removed" });
    fetchData();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("community_posts").update({ is_pinned: !pinned }).eq("id", id);
    toast({ title: pinned ? "Unpinned" : "Pinned 📌" });
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          Community Management
        </h2>
        <button onClick={fetchData} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="flex gap-2">
        {(["pending", "active", "posts"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {t === "pending" ? "Pending Approval" : t === "active" ? "Active Communities" : "All Posts"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : tab === "posts" ? (
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                <p className="text-[10px] text-muted-foreground">{p.post_type} • {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => togglePin(p.id, p.is_pinned)}
                  className={`p-1.5 rounded-lg text-xs ${p.is_pinned ? "bg-warning/15 text-warning" : "bg-secondary/50 text-muted-foreground"}`}>
                  📌
                </button>
                <button onClick={() => deletePost(p.id)} className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {posts.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No posts</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {communities.map(c => (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass rounded-xl p-4 neural-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.category} • {c.member_count} members • {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
              </div>
              <div className="flex gap-1">
                {tab === "pending" && (
                  <button onClick={() => approveCommunity(c.id)} className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => deleteCommunity(c.id)} className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
          {communities.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No communities</p>}
        </div>
      )}
    </div>
  );
};

export default CommunityManagement;
