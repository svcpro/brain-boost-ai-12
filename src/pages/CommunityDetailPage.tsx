import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, Users, MessageSquare, Plus, ThumbsUp,
  Brain, Send, ChevronDown, Eye, Clock, Sparkles, X,
  Tag, Lightbulb, Star, Zap, BookOpen, FileText,
  Bookmark, BookmarkCheck, Share2, Flame, Award,
  Heart, ThumbsDown, ArrowUp, ArrowDown, MoreHorizontal,
  Copy, Flag, CheckCircle2, Hash, Shield, TrendingUp,
  ChevronRight, ChevronUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const POST_TYPES = [
  { value: "question", label: "❓ Question", color: "bg-accent/10 text-accent" },
  { value: "solution", label: "💡 Solution", color: "bg-success/10 text-success" },
  { value: "doubt", label: "🤔 Doubt", color: "bg-warning/10 text-warning" },
  { value: "strategy", label: "📋 Strategy", color: "bg-primary/10 text-primary" },
];

const REACTIONS = [
  { type: "insightful", emoji: "💡", label: "Insightful" },
  { type: "helpful", emoji: "🙏", label: "Helpful" },
  { type: "mind_blown", emoji: "🤯", label: "Mind Blown" },
  { type: "agree", emoji: "✅", label: "Agree" },
];

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
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [myBookmarks, setMyBookmarks] = useState<Set<string>>(new Set());
  const [myReactions, setMyReactions] = useState<Record<string, Set<string>>>({});
  const [analyzingPost, setAnalyzingPost] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"hot" | "new" | "top">("hot");
  const [showSidebar, setShowSidebar] = useState(false);

  const fetchData = useCallback(async () => {
    if (!slug) return;
    const { data: comm } = await supabase.from("communities").select("*").eq("slug", slug).maybeSingle();
    if (!comm) { setLoading(false); return; }
    setCommunity(comm);

    const order = sortMode === "hot" ? "hot_score" : sortMode === "top" ? "upvote_count" : "created_at";
    const [postsRes, memberRes, votesRes, bookmarksRes, reactionsRes] = await Promise.all([
      supabase.from("community_posts").select("*").eq("community_id", comm.id).eq("is_deleted", false)
        .order("is_pinned", { ascending: false }).order(order, { ascending: false }).limit(50),
      user ? supabase.from("community_members").select("id").eq("community_id", comm.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      user ? (supabase as any).from("post_votes").select("target_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      user ? (supabase as any).from("post_bookmarks").select("post_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      user ? (supabase as any).from("post_reactions").select("post_id, reaction_type").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    setPosts(postsRes.data || []);
    setIsMember(!!memberRes.data);
    setMyVotes(new Set((votesRes.data || []).map((v: any) => v.target_id)));
    setMyBookmarks(new Set((bookmarksRes.data || []).map((b: any) => b.post_id)));
    const rMap: Record<string, Set<string>> = {};
    (reactionsRes.data || []).forEach((r: any) => {
      if (!rMap[r.post_id]) rMap[r.post_id] = new Set();
      rMap[r.post_id].add(r.reaction_type);
    });
    setMyReactions(rMap);
    setLoading(false);
  }, [slug, user, sortMode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!community) return;
    const channel = supabase.channel(`community-${community.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts', filter: `community_id=eq.${community.id}` },
        (payload) => setPosts(prev => [payload.new as any, ...prev]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' },
        (payload) => {
          const nc = payload.new as any;
          setComments(prev => ({ ...prev, [nc.post_id]: [...(prev[nc.post_id] || []), nc] }));
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_posts', filter: `community_id=eq.${community.id}` },
        (payload) => setPosts(prev => prev.map(p => p.id === (payload.new as any).id ? { ...p, ...payload.new } : p)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [community]);

  const joinCommunity = async () => {
    if (!user || !community) return;
    await supabase.from("community_members").insert({ community_id: community.id, user_id: user.id });
    setIsMember(true); toast({ title: "Joined! 🎉" });
  };

  const toggleVote = async (targetId: string) => {
    if (!user) return;
    if (myVotes.has(targetId)) {
      await (supabase as any).from("post_votes").delete().eq("user_id", user.id).eq("target_id", targetId);
      setMyVotes(prev => { const n = new Set(prev); n.delete(targetId); return n; });
      setPosts(prev => prev.map(p => p.id === targetId ? { ...p, upvote_count: Math.max(0, p.upvote_count - 1) } : p));
    } else {
      await (supabase as any).from("post_votes").insert({ user_id: user.id, target_id: targetId, target_type: "post" });
      setMyVotes(prev => new Set([...prev, targetId]));
      setPosts(prev => prev.map(p => p.id === targetId ? { ...p, upvote_count: p.upvote_count + 1 } : p));
    }
  };

  const toggleBookmark = async (postId: string) => {
    if (!user) return;
    if (myBookmarks.has(postId)) {
      await (supabase as any).from("post_bookmarks").delete().eq("user_id", user.id).eq("post_id", postId);
      setMyBookmarks(prev => { const n = new Set(prev); n.delete(postId); return n; });
      toast({ title: "Unsaved" });
    } else {
      await (supabase as any).from("post_bookmarks").insert({ user_id: user.id, post_id: postId });
      setMyBookmarks(prev => new Set([...prev, postId]));
      toast({ title: "Saved! 🔖" });
    }
  };

  const toggleReaction = async (postId: string, reactionType: string) => {
    if (!user) return;
    const has = myReactions[postId]?.has(reactionType);
    if (has) {
      await (supabase as any).from("post_reactions").delete().eq("user_id", user.id).eq("post_id", postId).eq("reaction_type", reactionType);
      setMyReactions(prev => {
        const updated = { ...prev };
        updated[postId] = new Set(updated[postId]);
        updated[postId].delete(reactionType);
        return updated;
      });
    } else {
      await (supabase as any).from("post_reactions").insert({ user_id: user.id, post_id: postId, reaction_type: reactionType });
      setMyReactions(prev => {
        const updated = { ...prev };
        if (!updated[postId]) updated[postId] = new Set();
        else updated[postId] = new Set(updated[postId]);
        updated[postId].add(reactionType);
        return updated;
      });
    }
    setShowReactions(null);
  };

  const loadComments = async (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    if (!comments[postId]) {
      const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).eq("is_deleted", false).order("created_at", { ascending: true });
      setComments(prev => ({ ...prev, [postId]: data || [] }));
    }
    // Increment view count
    const post = posts.find(p => p.id === postId);
    if (post) {
      supabase.from("community_posts").update({ view_count: (post.view_count || 0) + 1 }).eq("id", postId);
    }
  };

  const submitComment = async (postId: string) => {
    if (!user || !commentText[postId]?.trim()) return;
    const parentId = replyTo[postId] || null;
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId, user_id: user.id, content: commentText[postId].trim(), parent_id: parentId
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("community_posts").update({ comment_count: (posts.find(p => p.id === postId)?.comment_count || 0) + 1 }).eq("id", postId);
    setCommentText(prev => ({ ...prev, [postId]: "" }));
    setReplyTo(prev => ({ ...prev, [postId]: null }));
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
    } catch { toast({ title: "AI couldn't answer right now", variant: "destructive" }); }
  };

  const analyzePost = async (postId: string) => {
    setAnalyzingPost(postId);
    toast({ title: "AI analyzing... 🔍" });
    try {
      const res = await supabase.functions.invoke("discussion-intelligence", { body: { action: "analyze_post", post_id: postId } });
      if (res.error) throw new Error(res.error.message);
      const a = res.data?.analysis;
      if (a) {
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p, ai_summary: a.short_summary, ai_detailed_summary: a.detailed_summary,
          ai_key_points: a.key_points, ai_tags: a.tags, importance_score: a.importance_score,
          importance_level: a.importance_level, ai_key_insights: a.key_insights,
        } : p));
      }
      toast({ title: "Analysis complete! ✨" });
    } catch { toast({ title: "Analysis failed", variant: "destructive" }); }
    setAnalyzingPost(null);
  };

  const sharePost = async (post: any) => {
    const url = `${window.location.origin}/community/${slug}#${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, text: post.ai_summary || post.content.slice(0, 100), url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied! 📋" });
      }
    } catch { /* user cancelled */ }
  };

  // Build threaded comments
  const buildThread = (postId: string) => {
    const all = comments[postId] || [];
    const roots = all.filter(c => !c.parent_id);
    const childMap: Record<string, any[]> = {};
    all.forEach(c => {
      if (c.parent_id) {
        if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
        childMap[c.parent_id].push(c);
      }
    });
    return { roots, childMap };
  };

  const CommentNode = ({ comment, depth, postId, childMap }: { comment: any; depth: number; postId: string; childMap: Record<string, any[]> }) => {
    const children = childMap[comment.id] || [];
    const [collapsed, setCollapsed] = useState(depth > 2);

    return (
      <div className={`${depth > 0 ? "ml-4 pl-3 border-l-2 border-border" : ""}`}>
        <div className={`p-2.5 rounded-lg text-xs ${comment.is_ai_answer ? "bg-primary/5 border border-primary/20" : "bg-secondary/20 hover:bg-secondary/30"} transition-colors`}>
          <div className="flex items-center gap-2 mb-1">
            {comment.is_ai_answer ? (
              <><Brain className="w-3 h-3 text-primary" /><span className="text-[9px] text-primary font-semibold">AI Brain</span></>
            ) : (
              <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[8px] font-bold text-accent">
                {comment.user_id?.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
            {children.length > 0 && (
              <button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                {children.length} {children.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>
          <p className="text-foreground">{comment.content}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <button onClick={() => setReplyTo(prev => ({ ...prev, [postId]: comment.id }))}
              className="text-[9px] text-muted-foreground hover:text-primary font-medium">Reply</button>
          </div>
        </div>
        {!collapsed && children.length > 0 && (
          <div className="mt-1 space-y-1">
            {children.map(child => (
              <CommentNode key={child.id} comment={child} depth={depth + 1} postId={postId} childMap={childMap} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!community) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Community not found</p></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/community")} className="p-2 hover:bg-secondary rounded-lg"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-primary" />{community.name}
            </h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-2">
              <Users className="w-3 h-3" />{community.member_count}
              <MessageSquare className="w-3 h-3 ml-1" />{community.post_count}
            </p>
          </div>
          {!isMember ? (
            <button onClick={joinCommunity} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">Join</button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowCreatePost(true)} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Post
              </button>
            </div>
          )}
        </div>
        {/* Sort bar */}
        <div className="max-w-3xl mx-auto px-4 pb-2 flex items-center gap-2">
          {([
            { id: "hot" as const, label: "Hot", icon: Flame },
            { id: "new" as const, label: "New", icon: Clock },
            { id: "top" as const, label: "Top", icon: TrendingUp },
          ]).map(s => (
            <button key={s.id} onClick={() => setSortMode(s.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                sortMode === s.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <s.icon className="w-3 h-3" /> {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {community.description && (
          <div className="glass rounded-xl p-3 neural-border text-xs text-muted-foreground">{community.description}</div>
        )}

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No posts yet. Be the first!</p>
          </div>
        ) : (
          posts.map((post, i) => {
            const pt = POST_TYPES.find(t => t.value === post.post_type);
            const { roots, childMap } = buildThread(post.id);

            return (
              <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className={`glass rounded-xl neural-border overflow-hidden ${post.importance_level === "high" ? "border-l-[3px] border-l-destructive" : post.importance_level === "medium" ? "border-l-[3px] border-l-warning" : ""}`}>
                <div className="p-4 space-y-3">
                  <div className="flex gap-3">
                    {/* Vote Column */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <button onClick={() => toggleVote(post.id)}
                        className={`p-1 rounded transition-colors ${myVotes.has(post.id) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}>
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <span className={`text-xs font-bold ${myVotes.has(post.id) ? "text-primary" : "text-foreground"}`}>{post.upvote_count}</span>
                      <button className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">
                          {post.user_id?.slice(0, 2).toUpperCase()}
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${pt?.color || "bg-muted text-muted-foreground"}`}>
                          {pt?.label || post.post_type}
                        </span>
                        {post.is_pinned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">📌 Pinned</span>}
                        {post.importance_level === "high" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">🔥 Important</span>}
                        {post.ai_summary && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">🤖 Analyzed</span>}
                        {post.importance_score > 0 && (
                          <span className="text-[9px] text-muted-foreground ml-auto">Score: {post.importance_score}</span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mt-1.5">{post.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-6">{post.content}</p>

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
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {post.ai_summary && (
                    <div className="ml-10">
                      <button onClick={() => setExpandedSummary(expandedSummary === post.id ? null : post.id)}
                        className="flex items-center gap-1.5 text-[10px] text-primary font-medium hover:underline">
                        <FileText className="w-3 h-3" /> AI Summary & Insights
                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedSummary === post.id ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {expandedSummary === post.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-2 space-y-2">
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                              <p className="text-[11px] text-foreground font-medium">{post.ai_summary}</p>
                              {post.ai_detailed_summary && <p className="text-[10px] text-muted-foreground mt-2 border-t border-border pt-2">{post.ai_detailed_summary}</p>}
                            </div>
                            {post.ai_key_points?.length > 0 && (
                              <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
                                <p className="text-[10px] font-semibold text-accent mb-1.5 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Key Learning Points</p>
                                <ul className="space-y-1">
                                  {post.ai_key_points.map((pt: string, idx: number) => (
                                    <li key={idx} className="text-[10px] text-foreground flex items-start gap-1.5"><span className="text-accent mt-0.5">•</span> {pt}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {post.ai_key_insights?.length > 0 && (
                              <div className="p-3 rounded-lg bg-warning/5 border border-warning/15">
                                <p className="text-[10px] font-semibold text-warning mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> AI Key Insights</p>
                                <div className="space-y-1.5">
                                  {post.ai_key_insights.map((ins: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-1.5 text-[10px]">
                                      <span className={`px-1 py-0.5 rounded text-[8px] font-bold shrink-0 ${
                                        ins.type === "formula" ? "bg-primary/15 text-primary" :
                                        ins.type === "concept" ? "bg-accent/15 text-accent" :
                                        ins.type === "tip" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                                      }`}>{ins.type === "formula" ? "📐" : ins.type === "concept" ? "💡" : ins.type === "tip" ? "💎" : "📋"}</span>
                                      <span className="text-foreground">{ins.content}</span>
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

                  {/* AI Brain Answer */}
                  {post.ai_answer && (
                    <div className="ml-10 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Brain className="w-3.5 h-3.5 text-primary animate-pulse" />
                        <span className="text-[10px] font-semibold text-primary">AI Brain Answer</span>
                        <CheckCircle2 className="w-3 h-3 text-success ml-auto" />
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{post.ai_answer}</p>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center gap-1.5 ml-10 flex-wrap">
                    <button onClick={() => loadComments(post.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${expandedPost === post.id ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                      <MessageSquare className="w-3.5 h-3.5" /> {post.comment_count}
                    </button>

                    {/* Reactions */}
                    <div className="relative">
                      <button onClick={() => setShowReactions(showReactions === post.id ? null : post.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/50 text-[11px] text-muted-foreground hover:text-foreground">
                        <Heart className="w-3.5 h-3.5" />
                        {(myReactions[post.id]?.size || 0) > 0 && <span className="text-primary font-medium">{myReactions[post.id].size}</span>}
                      </button>
                      <AnimatePresence>
                        {showReactions === post.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 glass rounded-xl neural-border z-10">
                            {REACTIONS.map(r => (
                              <button key={r.type} onClick={() => toggleReaction(post.id, r.type)}
                                className={`p-1.5 rounded-lg text-sm hover:scale-125 transition-transform ${myReactions[post.id]?.has(r.type) ? "bg-primary/15" : "hover:bg-secondary/50"}`}
                                title={r.label}>
                                {r.emoji}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button onClick={() => toggleBookmark(post.id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${myBookmarks.has(post.id) ? "bg-warning/15 text-warning" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}>
                      {myBookmarks.has(post.id) ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    </button>

                    <button onClick={() => sharePost(post)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary/50 text-[11px] text-muted-foreground hover:text-foreground">
                      <Share2 className="w-3.5 h-3.5" />
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

                  {/* Threaded Comments */}
                  <AnimatePresence>
                    {expandedPost === post.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="ml-10 space-y-2 overflow-hidden">
                        {roots.length === 0 && !comments[post.id] && (
                          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                        )}
                        {roots.map(c => (
                          <CommentNode key={c.id} comment={c} depth={0} postId={post.id} childMap={childMap} />
                        ))}
                        {roots.length === 0 && comments[post.id] && (
                          <p className="text-[10px] text-muted-foreground text-center py-2">No comments yet</p>
                        )}
                        {isMember && (
                          <div className="space-y-1">
                            {replyTo[post.id] && (
                              <div className="flex items-center gap-1 text-[9px] text-primary">
                                <span>Replying to comment</span>
                                <button onClick={() => setReplyTo(prev => ({ ...prev, [post.id]: null }))} className="text-muted-foreground hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input value={commentText[post.id] || ""} onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && submitComment(post.id)}
                                placeholder={replyTo[post.id] ? "Write a reply..." : "Add a comment..."}
                                className="flex-1 px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                              <button onClick={() => submitComment(post.id)} className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

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
        <div className="flex gap-2 flex-wrap">
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
