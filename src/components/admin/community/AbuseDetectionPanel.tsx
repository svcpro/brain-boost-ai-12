import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Shield, Loader2, RefreshCw, Search, Eye,
  Check, X, Zap, ChevronDown, ChevronUp, UserX, Ban
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ContentFlag {
  id: string;
  content_type: string;
  content_id: string;
  user_id: string;
  abuse_score: number;
  risk_level: string;
  categories: string[];
  ai_reasoning: string | null;
  status: string;
  auto_hidden: boolean;
  created_at: string;
  content_preview?: string;
}

const AbuseDetectionPanel = () => {
  const { toast } = useToast();
  const [flags, setFlags] = useState<ContentFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "high" | "actioned">("pending");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    let q = (supabase as any).from("content_flags").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    else if (filter === "high") q = q.eq("risk_level", "high");
    else if (filter === "actioned") q = q.in("status", ["actioned", "reviewed"]);
    const { data } = await q;

    // Fetch content previews
    const flagsWithPreview = await Promise.all((data || []).map(async (f: any) => {
      let preview = "";
      if (f.content_type === "post") {
        const { data: post } = await supabase.from("community_posts").select("title, content").eq("id", f.content_id).maybeSingle();
        preview = post ? `${post.title}: ${post.content?.substring(0, 100)}` : "Deleted post";
      } else {
        const { data: comment } = await (supabase as any).from("post_comments").select("content").eq("id", f.content_id).maybeSingle();
        preview = comment?.content?.substring(0, 100) || "Deleted comment";
      }
      return { ...f, content_preview: preview };
    }));

    setFlags(flagsWithPreview);
    setLoading(false);
  };

  useEffect(() => { fetchFlags(); }, [filter]);

  const dismissFlag = async (id: string) => {
    await (supabase as any).from("content_flags").update({ status: "dismissed", reviewed_at: new Date().toISOString() }).eq("id", id);
    toast({ title: "Flag dismissed" });
    fetchFlags();
  };

  const actionFlag = async (id: string, flag: ContentFlag) => {
    await (supabase as any).from("content_flags").update({ status: "actioned", reviewed_at: new Date().toISOString() }).eq("id", id);
    // Delete the content
    if (flag.content_type === "post") {
      await supabase.from("community_posts").update({ is_deleted: true }).eq("id", flag.content_id);
    } else {
      await (supabase as any).from("post_comments").update({ is_deleted: true }).eq("id", flag.content_id);
    }
    toast({ title: "Content removed & flag actioned ✅" });
    fetchFlags();
  };

  const scanRecentPosts = async () => {
    setScanning(true);
    try {
      const { data: posts } = await supabase.from("community_posts")
        .select("id")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!posts?.length) {
        toast({ title: "No posts to scan" });
        setScanning(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("ai-content-moderator", {
        body: { action: "batch_analyze", post_ids: posts.map(p => p.id) },
      });

      if (error) throw error;
      const results = data?.results || [];
      const flagged = results.filter((r: any) => r.abuse_score > 20).length;
      toast({ title: `Scan complete: ${flagged} items flagged out of ${results.length}` });
      fetchFlags();
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    }
    setScanning(false);
  };

  const getRiskColor = (level: string) => {
    if (level === "high") return "bg-destructive/15 text-destructive";
    if (level === "medium") return "bg-warning/15 text-warning";
    return "bg-success/15 text-success";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-destructive";
    if (score >= 50) return "text-warning";
    if (score >= 30) return "text-yellow-500";
    return "text-success";
  };

  const filtered = flags.filter(f =>
    (f.content_preview || "").toLowerCase().includes(search.toLowerCase()) ||
    (f.ai_reasoning || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">AI Abuse Detection</h3>
        <div className="flex gap-2">
          <button onClick={scanRecentPosts} disabled={scanning}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1 disabled:opacity-50">
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {scanning ? "Scanning..." : "Scan Recent Posts"}
          </button>
          <button onClick={fetchFlags} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flags..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
        </div>
      </div>
      <div className="flex gap-2">
        {(["pending", "high", "actioned", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Flags List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-success/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No flagged content found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getRiskColor(f.risk_level)}`}>
                  <span className={`text-lg font-bold ${getScoreColor(f.abuse_score)}`}>{f.abuse_score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getRiskColor(f.risk_level)}`}>
                      {f.risk_level.toUpperCase()}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                      {f.content_type}
                    </span>
                    {f.auto_hidden && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">Auto-hidden</span>}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      f.status === "pending" ? "bg-warning/15 text-warning" : 
                      f.status === "actioned" ? "bg-destructive/15 text-destructive" : 
                      "bg-muted text-muted-foreground"
                    }`}>{f.status}</span>
                  </div>
                  <p className="text-xs text-foreground mt-1 line-clamp-1">{f.content_preview}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-muted-foreground">
                      {f.categories.join(", ")} • {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                    </p>
                    <button onClick={() => setExpandedId(expandedId === f.id ? null : f.id)} className="text-[10px] text-primary flex items-center gap-0.5">
                      {expandedId === f.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Details
                    </button>
                  </div>
                </div>
                {f.status === "pending" && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => actionFlag(f.id, f)} className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20" title="Remove content">
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => dismissFlag(f.id)} className="p-1.5 bg-success/10 text-success rounded-lg hover:bg-success/20" title="Dismiss">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {expandedId === f.id && (
                <div className="mt-2 p-3 rounded-lg bg-secondary/30 text-xs text-foreground/80">
                  <p className="font-medium mb-1">AI Reasoning:</p>
                  <p>{f.ai_reasoning || "No reasoning provided"}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">Content ID: {f.content_id} • User: {f.user_id.slice(0, 8)}...</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AbuseDetectionPanel;
