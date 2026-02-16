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
  Heart, ArrowUp, ArrowDown,
  CheckCircle2, Hash, TrendingUp,
  ChevronUp, Wand2, Activity, Target
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
      <div className={`${depth > 0 ? "ml-4 pl-3 border-l-2 border-border/50" : ""}`}>
        <div className={`p-3 rounded-xl text-xs ${comment.is_ai_answer ? "bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20" : "bg-card/80 border border-border/30 hover:border-border/60"} transition-all`}>
          <div className="flex items-center gap-2 mb-1.5">
            {comment.is_ai_answer ? (
              <>
                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Brain className="w-3 h-3 text-primary-foreground" />
                </div>
                <span className="text-[9px] text-primary font-bold">AI Brain</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Verified</span>
              </>
            ) : (
              <div className="w-5 h-5 rounded-lg bg-accent/10 flex items-center justify-center text-[8px] font-bold text-accent">
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
          <p className="text-foreground leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => setReplyTo(prev => ({ ...prev, [postId]: comment.id }))}
              className="text-[9px] text-muted-foreground hover:text-primary font-semibold transition-colors">Reply</button>
          </div>
        </div>
        {!collapsed && children.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {children.map(child => (
              <CommentNode key={child.id} comment={child} depth={depth + 1} postId={postId} childMap={childMap} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" />
      </div>
    </div>
  );
  if (!community) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Community not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/community")} className="p-2 hover:bg-secondary/80 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-foreground truncate flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                <Hash className="w-3.5 h-3.5 text-primary" />
              </div>
              {community.name}
            </h1>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{community.member_count} members</span>
              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{community.post_count} posts</span>
            </div>
          </div>
          {!isMember ? (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={joinCommunity}
              className="px-4 py-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-lg shadow-primary/15">
              Join
            </motion.button>
          ) : (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreatePost(true)}
              className="px-4 py-2 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-primary/15">
              <Plus className="w-3.5 h-3.5" /> Post
            </motion.button>
          )}
        </div>
        {/* Sort bar */}
        <div className="max-w-3xl mx-auto px-4 pb-2.5">
          <div className="flex items-center gap-1 p-1 bg-secondary/20 rounded-xl">
            {([
              { id: "hot" as const, label: "Hot", icon: Flame, color: "text-destructive" },
              { id: "new" as const, label: "New", icon: Clock, color: "text-success" },
              { id: "top" as const, label: "Top", icon: TrendingUp, color: "text-primary" },
            ]).map(s => (
              <button key={s.id} onClick={() => setSortMode(s.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  sortMode === s.id ? `bg-card border border-border/50 ${s.color} shadow-sm` : "text-muted-foreground hover:text-foreground"
                }`}>
                <s.icon className="w-3 h-3" /> {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3 pb-24">
        {/* Community Info Banner */}
        {community.description && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-br from-card to-card/80 border border-border/50 p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">{community.description}</p>
            {community.exam_type && (
              <span className="inline-flex items-center gap-1 mt-2 text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                <Target className="w-2.5 h-2.5" /> {community.exam_type}
              </span>
            )}
          </motion.div>
        )}

        {posts.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">No posts yet. Be the first!</p>
          </motion.div>
        ) : (
          posts.map((post, i) => {
            const pt = POST_TYPES.find(t => t.value === post.post_type);
            const { roots, childMap } = buildThread(post.id);

            return (
              <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02, type: "spring", stiffness: 300, damping: 30 }}
                className={`group rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 overflow-hidden transition-all duration-300 hover:border-border ${
                  post.importance_level === "high" ? "border-l-[3px] border-l-destructive" : post.importance_level === "medium" ? "border-l-[3px] border-l-warning" : ""
                }`}>
                <div className="p-4 space-y-3">
                  <div className="flex gap-3">
                    {/* Vote Column */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                        onClick={() => toggleVote(post.id)}
                        className={`p-1.5 rounded-lg transition-all ${myVotes.has(post.id) ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                        <ArrowUp className="w-4 h-4" />
                      </motion.button>
                      <span className={`text-xs font-bold ${myVotes.has(post.id) ? "text-primary" : "text-foreground"}`}>{post.upvote_count}</span>
                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-[9px] font-bold text-primary">
                          {post.user_id?.slice(0, 2).toUpperCase()}
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${pt?.color || "bg-muted text-muted-foreground"}`}>
                          {pt?.label || post.post_type}
                        </span>
                        {post.is_pinned && <span className="text-[9px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">📌 Pinned</span>}
                        {post.importance_level === "high" && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-destructive/15 to-warning/15 text-destructive font-semibold flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Important
                          </span>
                        )}
                        {post.ai_summary && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 text-primary font-semibold flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> Analyzed
                          </span>
                        )}
                        {post.importance_score > 0 && (
                          <span className="text-[9px] text-muted-foreground ml-auto flex items-center gap-0.5">
                            <Activity className="w-2.5 h-2.5" /> {post.importance_score}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-foreground mt-2">{post.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap line-clamp-6 leading-relaxed">{post.content}</p>

                      {/* AI Tags */}
                      {post.ai_tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {post.ai_tags.map((tag: string) => (
                            <span key={tag} className="text-[8px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 font-medium border border-primary/10 flex items-center gap-0.5">
                              <Tag className="w-2.5 h-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {post.ai_summary && (
                    <div className="ml-10">
                      <button onClick={() => setExpandedSummary(expandedSummary === post.id ? null : post.id)}
                        className="flex items-center gap-1.5 text-[10px] text-primary font-semibold hover:underline">
                        <FileText className="w-3 h-3" /> AI Summary & Insights
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedSummary === post.id ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {expandedSummary === post.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mt-2 space-y-2.5">
                            <div className="p-3.5 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/15">
                              <p className="text-[11px] text-foreground font-medium leading-relaxed">{post.ai_summary}</p>
                              {post.ai_detailed_summary && <p className="text-[10px] text-muted-foreground mt-2.5 border-t border-border/30 pt-2.5 leading-relaxed">{post.ai_detailed_summary}</p>}
                            </div>
                            {post.ai_key_points?.length > 0 && (
                              <div className="p-3.5 rounded-xl bg-gradient-to-r from-accent/5 to-accent/3 border border-accent/15">
                                <p className="text-[10px] font-bold text-accent mb-2 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Key Learning Points</p>
                                <ul className="space-y-1.5">
                                  {post.ai_key_points.map((pt: string, idx: number) => (
                                    <li key={idx} className="text-[10px] text-foreground flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-accent mt-0.5 shrink-0" /> {pt}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {post.ai_key_insights?.length > 0 && (
                              <div className="p-3.5 rounded-xl bg-gradient-to-r from-warning/5 to-warning/3 border border-warning/15">
                                <p className="text-[10px] font-bold text-warning mb-2 flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> AI Key Insights</p>
                                <div className="space-y-2">
                                  {post.ai_key_insights.map((ins: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 text-[10px]">
                                      <span className={`px-1.5 py-0.5 rounded-lg text-[8px] font-bold shrink-0 ${
                                        ins.type === "formula" ? "bg-primary/15 text-primary" :
                                        ins.type === "concept" ? "bg-accent/15 text-accent" :
                                        ins.type === "tip" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                                      }`}>{ins.type === "formula" ? "📐" : ins.type === "concept" ? "💡" : ins.type === "tip" ? "💎" : "📋"}</span>
                                      <span className="text-foreground leading-relaxed">{ins.content}</span>
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
                    <div className="ml-10 p-3.5 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <Brain className="w-3 h-3 text-primary-foreground" />
                        </div>
                        <span className="text-[10px] font-bold text-primary">AI Brain Answer</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-success ml-auto" />
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{post.ai_answer}</p>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center gap-1.5 ml-10 flex-wrap">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => loadComments(post.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${expandedPost === post.id ? "bg-primary/15 text-primary border border-primary/20" : "bg-secondary/30 text-muted-foreground hover:text-foreground border border-transparent"}`}>
                      <MessageSquare className="w-3.5 h-3.5" /> {post.comment_count}
                    </motion.button>

                    {/* Reactions */}
                    <div className="relative">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setShowReactions(showReactions === post.id ? null : post.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary/30 text-[11px] text-muted-foreground hover:text-foreground border border-transparent">
                        <Heart className="w-3.5 h-3.5" />
                        {(myReactions[post.id]?.size || 0) > 0 && <span className="text-primary font-bold">{myReactions[post.id].size}</span>}
                      </motion.button>
                      <AnimatePresence>
                        {showReactions === post.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute bottom-full left-0 mb-1.5 flex gap-1 p-2 bg-card border border-border/50 rounded-2xl shadow-xl z-10">
                            {REACTIONS.map(r => (
                              <motion.button key={r.type} whileHover={{ scale: 1.3 }} whileTap={{ scale: 0.9 }}
                                onClick={() => toggleReaction(post.id, r.type)}
                                className={`p-2 rounded-xl text-sm transition-all ${myReactions[post.id]?.has(r.type) ? "bg-primary/15 shadow-inner" : "hover:bg-secondary/60"}`}
                                title={r.label}>
                                {r.emoji}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => toggleBookmark(post.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${myBookmarks.has(post.id) ? "bg-warning/10 text-warning border-warning/20" : "bg-secondary/30 text-muted-foreground hover:text-foreground border-transparent"}`}>
                      {myBookmarks.has(post.id) ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                    </motion.button>

                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => sharePost(post)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary/30 text-[11px] text-muted-foreground hover:text-foreground border border-transparent">
                      <Share2 className="w-3.5 h-3.5" />
                    </motion.button>

                    {!post.ai_answer && post.post_type === "question" && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => requestAIAnswer(post.id, post.content, post.title)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 text-[11px] text-primary font-semibold border border-primary/15 hover:border-primary/30">
                        <Sparkles className="w-3.5 h-3.5" /> Ask AI
                      </motion.button>
                    )}
                    {!post.ai_summary && (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => analyzePost(post.id)} disabled={analyzingPost === post.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-accent/10 to-primary/10 text-[11px] text-accent font-semibold border border-accent/15 hover:border-accent/30 disabled:opacity-50">
                        {analyzingPost === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                        Analyze
                      </motion.button>
                    )}
                  </div>

                  {/* Threaded Comments */}
                  <AnimatePresence>
                    {expandedPost === post.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="ml-10 space-y-2 overflow-hidden">
                        {roots.length === 0 && !comments[post.id] && (
                          <div className="flex justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          </div>
                        )}
                        {roots.map(c => (
                          <CommentNode key={c.id} comment={c} depth={0} postId={post.id} childMap={childMap} />
                        ))}
                        {roots.length === 0 && comments[post.id] && (
                          <p className="text-[10px] text-muted-foreground text-center py-3">No comments yet. Be the first to reply!</p>
                        )}
                        {isMember && (
                          <div className="space-y-1.5">
                            {replyTo[post.id] && (
                              <div className="flex items-center gap-1 text-[9px] text-primary font-medium">
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
                                className="flex-1 px-4 py-2.5 bg-secondary/30 border border-border/50 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={() => submitComment(post.id)}
                                className="p-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl shadow-md shadow-primary/15">
                                <Send className="w-3.5 h-3.5" />
                              </motion.button>
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
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // AI enhancement states
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [loadingEnhance, setLoadingEnhance] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [qualityScore, setQualityScore] = useState<{ score: number; feedback: string; suggestions: string[] } | null>(null);
  const [loadingQuality, setLoadingQuality] = useState(false);

  const generateTags = async () => {
    if (!title.trim() && !content.trim()) return;
    setLoadingTags(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "suggest_post_tags", title, content }
      });
      if (res.data?.tags) setAiTags(res.data.tags);
    } catch { /* ignore */ }
    setLoadingTags(false);
  };

  const suggestTitles = async () => {
    console.log("[AI Suggest] content value:", JSON.stringify(content), "length:", content.length);
    if (!content.trim()) { toast({ title: "✍️ Write some content first so AI can suggest titles" }); return; }
    setLoadingTitles(true);
    toast({ title: "🔄 Generating title suggestions..." });
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "enhance_post", content, post_type: postType, enhance_type: "suggest_title" }
      });
      console.log("[AI Suggest] response:", JSON.stringify(res.data), "error:", res.error);
      if (res.error) { toast({ title: "AI error", description: String(res.error), variant: "destructive" }); }
      else if (res.data?.titles) { setTitleSuggestions(res.data.titles); toast({ title: "✅ Title suggestions ready!" }); }
      else toast({ title: "No suggestions returned", variant: "destructive" });
    } catch (e) { console.error("[AI Suggest] exception:", e); toast({ title: "AI Suggest failed", description: String(e), variant: "destructive" }); }
    setLoadingTitles(false);
  };

  const improveContent = async () => {
    if (!content.trim()) { toast({ title: "✍️ Write some content first to enhance" }); return; }
    setLoadingEnhance(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "enhance_post", title, content, post_type: postType, enhance_type: "improve_content" }
      });
      if (res.error) { toast({ title: "AI error", description: String(res.error), variant: "destructive" }); }
      else if (res.data?.improved_content) setContent(res.data.improved_content);
      else toast({ title: "No enhancement returned", variant: "destructive" });
    } catch (e) { toast({ title: "Couldn't enhance content", description: String(e), variant: "destructive" }); }
    setLoadingEnhance(false);
  };

  const generateContent = async () => {
    if (!title.trim()) { toast({ title: "📝 Enter a title first so AI can write content" }); return; }
    setLoadingGenerate(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "enhance_post", title, post_type: postType, enhance_type: "generate_content" }
      });
      if (res.error) { toast({ title: "AI error", description: String(res.error), variant: "destructive" }); }
      else if (res.data?.generated_content) setContent(res.data.generated_content);
      else toast({ title: "No content generated", variant: "destructive" });
    } catch (e) { toast({ title: "Couldn't generate content", description: String(e), variant: "destructive" }); }
    setLoadingGenerate(false);
  };

  const checkQuality = async () => {
    if (!title.trim() || !content.trim()) return;
    setLoadingQuality(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "enhance_post", title, content, post_type: postType, enhance_type: "quality_check" }
      });
      if (res.data?.score !== undefined) setQualityScore(res.data);
    } catch { /* ignore */ }
    setLoadingQuality(false);
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("community_posts").insert({
      community_id: communityId, user_id: user.id, title: title.trim(), content: content.trim(), post_type: postType,
      ai_tags: aiTags.length > 0 ? aiTags : null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
    toast({ title: "Post created! 📝" });
    onCreated();
  };

  const qualityColor = qualityScore ? (qualityScore.score >= 80 ? "text-success" : qualityScore.score >= 50 ? "text-warning" : "text-destructive") : "";

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-lg bg-card border border-border/50 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-primary/5"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/30 px-5 py-4 flex items-center gap-3 z-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <FileText className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Create Post
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> AI Enhanced
              </span>
            </h2>
            <p className="text-[10px] text-muted-foreground">AI helps you write better posts</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Post Type */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-2 block">Post Type</label>
            <div className="grid grid-cols-2 gap-2">
              {POST_TYPES.map(t => (
                <button key={t.value} onClick={() => setPostType(t.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all duration-200 ${
                    postType === t.value
                      ? "border-primary/50 bg-primary/10 shadow-md shadow-primary/5"
                      : "border-border/50 bg-secondary/20 hover:bg-secondary/40"
                  }`}>
                  <span className={`text-[11px] font-semibold ${postType === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title with AI suggestions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">Title</label>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={suggestTitles} disabled={loadingTitles}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] font-semibold disabled:opacity-50 hover:from-primary/25 hover:to-accent/25 transition-all">
                {loadingTitles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                AI Suggest Titles
              </motion.button>
            </div>
            <input value={title} onChange={e => { setTitle(e.target.value); setQualityScore(null); }} placeholder="What's your question or topic?"
              className="w-full px-4 py-3 bg-secondary/30 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            {titleSuggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 space-y-1.5">
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1"><Lightbulb className="w-3 h-3" /> AI Title Ideas</span>
                {titleSuggestions.map((t, i) => (
                  <motion.button key={i} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => { setTitle(t); setTitleSuggestions([]); setQualityScore(null); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-medium bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/15 text-foreground hover:border-primary/40 transition-all">
                    {t}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Content with AI tools */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">Content</label>
              <div className="flex gap-1">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={generateContent} disabled={loadingGenerate}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-accent/15 to-primary/15 text-accent text-[9px] font-semibold disabled:opacity-50 hover:from-accent/25 hover:to-primary/25 transition-all"
                  title="AI writes content based on your title">
                  {loadingGenerate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                  AI Write
                </motion.button>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={improveContent} disabled={loadingEnhance}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[9px] font-semibold disabled:opacity-50 hover:from-primary/25 hover:to-accent/25 transition-all"
                  title="AI improves your existing content">
                  {loadingEnhance ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  Enhance
                </motion.button>
              </div>
            </div>
            <textarea value={content} onChange={e => { setContent(e.target.value); setQualityScore(null); }} placeholder="Describe in detail..." rows={5}
              className="w-full px-4 py-3 bg-secondary/30 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
          </div>

          {/* AI Quality Check */}
          <div className="flex items-center gap-2">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={checkQuality} disabled={loadingQuality || !title.trim() || !content.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/40 border border-border/50 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-all">
              {loadingQuality ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
              AI Quality Check
            </motion.button>
            {qualityScore && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2">
                <div className={`text-lg font-bold ${qualityColor}`}>{qualityScore.score}</div>
                <span className="text-[9px] text-muted-foreground">/100</span>
              </motion.div>
            )}
          </div>
          {qualityScore && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/15 p-3 space-y-2">
              <p className="text-[11px] text-foreground font-medium">{qualityScore.feedback}</p>
              {qualityScore.suggestions?.length > 0 && (
                <div className="space-y-1">
                  {qualityScore.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                      <Lightbulb className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* AI Tag Suggestions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-foreground">AI Tags</label>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={generateTags} disabled={loadingTags || (!title.trim() && !content.trim())}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] font-semibold disabled:opacity-50">
                {loadingTags ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tag className="w-3 h-3" />}
                Generate Tags
              </motion.button>
            </div>
            {aiTags.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-1.5">
                {aiTags.map(tag => (
                  <span key={tag} className="text-[9px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold border border-primary/15 flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" /> {tag}
                  </span>
                ))}
              </motion.div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={handleCreate} disabled={!title.trim() || !content.trim() || loading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Post
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CommunityDetailPage;
