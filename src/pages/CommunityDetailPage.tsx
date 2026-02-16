import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Users, MessageSquare, Plus, ThumbsUp,
  Brain, Send, ChevronDown, Eye, Clock, Sparkles, X,
  Tag, Lightbulb, Star, Zap, BookOpen, FileText
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const POST_TYPES = [
  { value: "question", label: "❓ Question" },
  { value: "solution", label: "💡 Solution" },
  { value: "doubt", label: "🤔 Doubt" },
  { value: "strategy", label: "📋 Strategy" },
];

const IMPORTANCE_BADGE: Record<string, { label: string; cls: string }> = {
  high: { label: "🔥 High Importance", cls: "bg-destructive/15 text-destructive" },
  medium: { label: "⭐ Medium", cls: "bg-warning/15 text-warning" },
  normal: { label: "", cls: "" },
};

const CommunityDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [analyzingPost, setAnalyzingPost] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!slug) return;
    const { data: comm } = await supabase.from("communities").select("*").eq("slug", slug).maybeSingle();
    if (!comm) { setLoading(false); return; }
    setCommunity(comm);

    const [postsRes, memberRes, votesRes] = await Promise.all([
      supabase.from("community_posts").select("*").eq("community_id", comm.id).eq("is_deleted", false).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50),
      user ? supabase.from("community_members").select("id").eq("community_id", comm.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      user ? (supabase as any).from("post_votes").select("target_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    setPosts(postsRes.data || []);
    setIsMember(!!memberRes.data);
    setMyVotes(new Set((votesRes.data || []).map((v: any) => v.target_id)));
    setLoading(false);
  }, [slug, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!community) return;
    const channel = supabase.channel(`community-${community.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts', filter: `community_id=eq.${community.id}` }, (payload) => {
        setPosts(prev => [payload.new as any, ...prev]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (payload) => {
        const newComment = payload.new as any;
        setComments(prev => ({ ...prev, [newComment.post_id]: [...(prev[newComment.post_id] || []), newComment] }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [community]);

  const joinCommunity = async () => {
    if (!user || !community) return;
    await supabase.from("community_members").insert({ community_id: community.id, user_id: user.id });
    setIsMember(true);
    toast({ title: "Joined! 🎉" });
  };

  const toggleVote = async (targetId: string, targetType: string) => {
    if (!user) return;
    if (myVotes.has(targetId)) {
      await (supabase as any).from("post_votes").delete().eq("user_id", user.id).eq("target_id", targetId);
      setMyVotes(prev => { const n = new Set(prev); n.delete(targetId); return n; });
      if (targetType === "post") setPosts(prev => prev.map(p => p.id === targetId ? { ...p, upvote_count: Math.max(0, p.upvote_count - 1) } : p));
    } else {
      await (supabase as any).from("post_votes").insert({ user_id: user.id, target_id: targetId, target_type: targetType });
      setMyVotes(prev => new Set([...prev, targetId]));
      if (targetType === "post") setPosts(prev => prev.map(p => p.id === targetId ? { ...p, upvote_count: p.upvote_count + 1 } : p));
    }
  };

  const loadComments = async (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    if (!comments[postId]) {
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).eq("is_deleted", false).order("created_at", { ascending: true });
      setComments(prev => ({ ...prev, [postId]: data || [] }));
    }
  };

  const submitComment = async (postId: string) => {
    if (!user || !commentText[postId]?.trim()) return;
    const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, content: commentText[postId].trim() });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("community_posts").update({ comment_count: (posts.find(p => p.id === postId)?.comment_count || 0) + 1 }).eq("id", postId);
    setCommentText(prev => ({ ...prev, [postId]: "" }));
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).eq("is_deleted", false).order("created_at", { ascending: true });
    setComments(prev => ({ ...prev, [postId]: data || [] }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
  };

  const requestAIAnswer = async (postId: string, postContent: string, postTitle: string) => {
    toast({ title: "AI is thinking... 🧠" });
    try {
      const res = await supabase.functions.invoke("ai-community-answer", { body: { post_id: postId, title: postTitle, content: postContent } });
      if (res.error) throw new Error(res.error.message);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ai_answer: res.data?.answer, ai_answered_at: new Date().toISOString() } : p));
      toast({ title: "AI answered! ✨" });
    } catch {
      toast({ title: "AI couldn't answer right now", variant: "destructive" });
    }
  };

  const analyzePost = async (postId: string) => {
    setAnalyzingPost(postId);
    toast({ title: "AI analyzing discussion... 🔍" });
    try {
      const res = await supabase.functions.invoke("discussion-intelligence", {
        body: { action: "analyze_post", post_id: postId },
      });
      if (res.error) throw new Error(res.error.message);
      const analysis = res.data?.analysis;
      if (analysis) {
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          ai_summary: analysis.short_summary,
          ai_detailed_summary: analysis.detailed_summary,
          ai_key_points: analysis.key_points,
          ai_tags: analysis.tags,
          importance_score: analysis.importance_score,
          importance_level: analysis.importance_level,
          ai_key_insights: analysis.key_insights,
        } : p));
      }
      toast({ title: "Analysis complete! ✨" });
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    }
    setAnalyzingPost(null);
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!community) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Community not found</p></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/community")} className="p-2 hover:bg-secondary rounded-lg"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{community.name}</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-2">
              <Users className="w-3 h-3" />{community.member_count} members
              <MessageSquare className="w-3 h-3 ml-1" />{community.post_count} posts
            </p>
          </div>
          {!isMember ? (
            <button onClick={joinCommunity} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">Join</button>
          ) : (
            <button onClick={() => setShowCreatePost(true)} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Post
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {community.description && (
          <div className="glass rounded-xl p-3 neural-border">
            <p className="text-xs text-muted-foreground">{community.description}</p>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No posts yet. Be the first!</p>
          </div>
        ) : (
          posts.map((post, i) => {
            const imp = IMPORTANCE_BADGE[post.importance_level] || IMPORTANCE_BADGE.normal;
            return (
              <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="glass rounded-xl p-4 neural-border space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {post.user_id?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {POST_TYPES.find(t => t.value === post.post_type)?.label || post.post_type}
                      </span>
                      {post.is_pinned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">📌 Pinned</span>}
                      {imp.label && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${imp.cls}`}>{imp.label}</span>}
                      {post.importance_score > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          Score: {post.importance_score}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mt-1">{post.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">{post.content}</p>

                    {/* AI Tags */}
                    {post.ai_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.ai_tags.map((tag: string) => (
                          <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-0.5">
                            <Tag className="w-2.5 h-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>

                {/* AI Summary Section */}
                {post.ai_summary && (
                  <div className="ml-11">
                    <button onClick={() => setExpandedSummary(expandedSummary === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-[10px] text-primary font-medium hover:underline">
                      <FileText className="w-3 h-3" /> AI Summary
                      <ChevronDown className={`w-3 h-3 transition-transform ${expandedSummary === post.id ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {expandedSummary === post.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-2 space-y-2">
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <p className="text-[11px] text-foreground">{post.ai_summary}</p>
                            {post.ai_detailed_summary && (
                              <p className="text-[10px] text-muted-foreground mt-2 border-t border-border pt-2">{post.ai_detailed_summary}</p>
                            )}
                          </div>

                          {/* Key Points */}
                          {post.ai_key_points?.length > 0 && (
                            <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
                              <p className="text-[10px] font-semibold text-accent mb-1.5 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Key Points</p>
                              <ul className="space-y-1">
                                {post.ai_key_points.map((pt: string, idx: number) => (
                                  <li key={idx} className="text-[10px] text-foreground flex items-start gap-1.5">
                                    <span className="text-accent mt-0.5">•</span> {pt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Key Insights */}
                          {post.ai_key_insights?.length > 0 && (
                            <div className="p-3 rounded-lg bg-warning/5 border border-warning/15">
                              <p className="text-[10px] font-semibold text-warning mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> AI Key Insights</p>
                              <div className="space-y-1.5">
                                {post.ai_key_insights.map((insight: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-1.5 text-[10px]">
                                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                                      insight.type === "formula" ? "bg-primary/15 text-primary" :
                                      insight.type === "concept" ? "bg-accent/15 text-accent" :
                                      insight.type === "tip" ? "bg-warning/15 text-warning" :
                                      "bg-muted text-muted-foreground"
                                    }`}>
                                      {insight.type === "formula" ? "📐" : insight.type === "concept" ? "💡" : insight.type === "tip" ? "💎" : "📋"}
                                    </span>
                                    <span className="text-foreground">{insight.content}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* AI Answer */}
                {post.ai_answer && (
                  <div className="ml-11 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Brain className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-semibold text-primary">AI Brain Answer</span>
                    </div>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{post.ai_answer}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 ml-11 flex-wrap">
                  <button onClick={() => toggleVote(post.id, "post")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${myVotes.has(post.id) ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                    <ThumbsUp className="w-3.5 h-3.5" /> {post.upvote_count}
                  </button>
                  <button onClick={() => loadComments(post.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/50 text-[11px] text-muted-foreground hover:text-foreground">
                    <MessageSquare className="w-3.5 h-3.5" /> {post.comment_count}
                  </button>
                  {!post.ai_answer && post.post_type === "question" && (
                    <button onClick={() => requestAIAnswer(post.id, post.content, post.title)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-[11px] text-primary font-medium hover:bg-primary/20">
                      <Sparkles className="w-3.5 h-3.5" /> Ask AI
                    </button>
                  )}
                  {!post.ai_summary && (
                    <button onClick={() => analyzePost(post.id)} disabled={analyzingPost === post.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/10 text-[11px] text-accent font-medium hover:bg-accent/20 disabled:opacity-50">
                      {analyzingPost === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                      Analyze
                    </button>
                  )}
                </div>

                {/* Comments */}
                <AnimatePresence>
                  {expandedPost === post.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="ml-11 space-y-2 overflow-hidden">
                      {(comments[post.id] || []).map(c => (
                        <div key={c.id} className={`p-2.5 rounded-lg text-xs ${c.is_ai_answer ? "bg-primary/5 border border-primary/20" : "bg-secondary/30"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            {c.is_ai_answer ? <Brain className="w-3 h-3 text-primary" /> : <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[8px] font-bold text-accent">{c.user_id?.slice(0, 2).toUpperCase()}</div>}
                            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                            {c.is_ai_answer && <span className="text-[9px] text-primary font-semibold">AI Brain</span>}
                          </div>
                          <p className="text-foreground">{c.content}</p>
                        </div>
                      ))}
                      {isMember && (
                        <div className="flex gap-2">
                          <input value={commentText[post.id] || ""} onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && submitComment(post.id)}
                            placeholder="Write a reply..."
                            className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                          <button onClick={() => submitComment(post.id)} className="p-2 bg-primary text-primary-foreground rounded-lg">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreatePost && <CreatePostModal communityId={community.id} onClose={() => setShowCreatePost(false)} onCreated={() => { setShowCreatePost(false); fetchData(); }} />}
      </AnimatePresence>
    </div>
  );
};

const CreatePostModal = ({ communityId, onClose, onCreated }: { communityId: string; onClose: () => void; onCreated: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState("question");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("community_posts").insert({
      community_id: communityId, user_id: user.id, title: title.trim(), content: content.trim(), post_type: postType,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
    toast({ title: "Post created! 📝" });
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md glass rounded-2xl neural-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Create Post</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="flex gap-2">
          {POST_TYPES.map(t => (
            <button key={t.value} onClick={() => setPostType(t.value)}
              className={`text-[10px] px-2.5 py-1.5 rounded-full font-medium transition-colors ${postType === t.value ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Post title"
          className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your post..." rows={5}
          className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={!title.trim() || !content.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Post
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CommunityDetailPage;
