import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, BookOpen, ArrowLeft, Loader2,
  GraduationCap, Atom, Globe2, MessageSquare, TrendingUp,
  Sparkles, Star, Brain, Tag, Zap, Flame, Clock,
  Award, Crown, Shield, ChevronRight, Bookmark, Eye,
  BarChart3, Filter, ArrowUpRight, Hash, Wand2, RefreshCw,
  Target, Lightbulb, CheckCircle2, X, FileText,
  Compass, Layers, Activity
} from "lucide-react";

const CATEGORY_ICONS: Record<string, any> = {
  exam: GraduationCap, subject: Atom, topic: BookOpen, general: Globe2,
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  exam: "from-primary/30 via-accent/20 to-primary/10",
  subject: "from-accent/30 via-primary/20 to-accent/10",
  topic: "from-warning/30 via-warning/10 to-warning/5",
  general: "from-secondary via-secondary/50 to-secondary/30",
};

const CommunityPage = ({ inline = false }: { inline?: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<any[]>([]);
  const [myMemberships, setMyMemberships] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [activeView, setActiveView] = useState<"feed" | "communities" | "recommended" | "important" | "saved">("feed");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [importantPosts, setImportantPosts] = useState<any[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<"hot" | "new" | "top">("hot");
  const [myKarma, setMyKarma] = useState(0);

  const fetchData = useCallback(async () => {
    const [commRes, memRes] = await Promise.all([
      supabase.from("communities").select("*").eq("is_approved", true).eq("is_active", true).order("member_count", { ascending: false }),
      user ? supabase.from("community_members").select("community_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    setCommunities(commRes.data || []);
    setMyMemberships(new Set((memRes.data || []).map((m: any) => m.community_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("user_reputation").select("karma_points").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
      if (data) setMyKarma(data.karma_points || 0);
    });
  }, [user]);

  const fetchFeed = useCallback(async () => {
    if (activeView !== "feed") return;
    setLoadingAI(true);
    const order = sortMode === "hot" ? "hot_score" : sortMode === "top" ? "upvote_count" : "created_at";
    const { data } = await supabase.from("community_posts")
      .select("*, communities!community_posts_community_id_fkey(name, slug)")
      .eq("is_deleted", false)
      .order(order, { ascending: false })
      .limit(30);
    setTrendingPosts(data || []);
    setLoadingAI(false);
  }, [activeView, sortMode]);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const fetchRecommendations = async () => {
    setLoadingAI(true);
    try {
      const res = await supabase.functions.invoke("discussion-intelligence", { body: { action: "get_recommendations" } });
      if (res.error) throw new Error(res.error.message);
      setRecommendations(res.data?.recommendations || []);
      setWeakTopics(res.data?.weak_topics || []);
    } catch { toast({ title: "Couldn't load recommendations", variant: "destructive" }); }
    setLoadingAI(false);
  };

  const fetchImportant = async () => {
    setLoadingAI(true);
    try {
      const res = await supabase.functions.invoke("discussion-intelligence", { body: { action: "get_important" } });
      if (res.error) throw new Error(res.error.message);
      setImportantPosts(res.data?.posts || []);
    } catch { toast({ title: "Couldn't load important discussions", variant: "destructive" }); }
    setLoadingAI(false);
  };

  const fetchSaved = async () => {
    if (!user) return;
    setLoadingAI(true);
    const { data } = await (supabase as any).from("post_bookmarks")
      .select("post_id, community_posts!post_bookmarks_post_id_fkey(id, title, ai_summary, ai_tags, upvote_count, comment_count, post_type, created_at, importance_level, communities!community_posts_community_id_fkey(name, slug))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setSavedPosts((data || []).map((d: any) => d.community_posts).filter(Boolean));
    setLoadingAI(false);
  };

  useEffect(() => {
    if (activeView === "recommended") fetchRecommendations();
    else if (activeView === "important") fetchImportant();
    else if (activeView === "saved") fetchSaved();
  }, [activeView]);

  const joinCommunity = async (communityId: string) => {
    if (!user) return;
    const { error } = await supabase.from("community_members").insert({ community_id: communityId, user_id: user.id });
    if (error && error.code !== "23505") { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    await supabase.from("communities").update({ member_count: (communities.find(c => c.id === communityId)?.member_count || 0) + 1 }).eq("id", communityId);
    setMyMemberships(prev => new Set([...prev, communityId]));
    toast({ title: "Joined! 🎉" });
    fetchData();
  };

  const filtered = communities.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== "all" && c.category !== filter) return false;
    return true;
  });

  const PostCard = ({ post, index, showCommunity = false }: { post: any; index: number; showCommunity?: boolean }) => {
    const impCls = post.importance_level === "high" ? "border-l-destructive" : post.importance_level === "medium" ? "border-l-warning" : "border-l-transparent";
    return (
      <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03, type: "spring", stiffness: 300, damping: 30 }}
        className={`group relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer border-l-[3px] ${impCls} overflow-hidden`}
        onClick={() => {
          const slug = post.communities?.slug;
          if (slug) navigate(`/community/${slug}`);
        }}>
        {/* Hover glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="relative p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 shrink-0 min-w-[36px]">
              <div className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center ${
                (post.upvote_count || 0) > 10 ? "bg-primary/15 text-primary" : "bg-secondary/80 text-muted-foreground"
              }`}>
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold leading-none mt-0.5">{post.upvote_count || 0}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {showCommunity && post.communities && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-4 h-4 rounded-md bg-primary/15 flex items-center justify-center">
                    <Hash className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <span className="text-[10px] text-primary font-semibold">{post.communities.name}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold uppercase tracking-wide">{post.post_type}</span>
                {post.importance_level === "high" && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-destructive/20 to-warning/20 text-destructive font-semibold flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5" /> Trending
                  </span>
                )}
                {post.is_pinned && <span className="text-[9px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">📌 Pinned</span>}
                {post.ai_summary && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary font-semibold flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-foreground mt-1.5 line-clamp-2 group-hover:text-primary transition-colors">{post.title}</h3>
              {post.ai_summary && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{post.ai_summary}</p>}
              {post.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {post.ai_tags.slice(0, 3).map((tag: string) => (
                    <span key={tag} className="text-[8px] px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 font-medium border border-primary/10">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-2.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comment_count || 0}</span>
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count || 0}</span>
                {post.importance_score > 0 && (
                  <span className="flex items-center gap-1 text-primary/70"><Activity className="w-3 h-3" />{post.importance_score}</span>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-3 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </motion.div>
    );
  };

  const views = [
    { id: "feed" as const, label: "Feed", icon: Flame, glow: true },
    { id: "communities" as const, label: "Explore", icon: Compass },
    { id: "recommended" as const, label: "For You", icon: Brain, ai: true },
    { id: "important" as const, label: "Top", icon: Crown },
    { id: "saved" as const, label: "Saved", icon: Bookmark },
  ];

  return (
    <div className={inline ? "" : "min-h-screen bg-background"}>
      {/* Premium Header - only show when standalone */}
      {!inline && (
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/app")} className="p-2 hover:bg-secondary/80 rounded-xl transition-colors">
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                      <Users className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
                  </div>
                  Community
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary font-semibold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {myKarma > 0 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-warning/15 to-warning/5 border border-warning/20">
                    <Award className="w-3.5 h-3.5 text-warning" />
                    <span className="text-[10px] font-bold text-warning">{myKarma}</span>
                  </motion.div>
                )}
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreate(true)} className="p-2.5 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Premium Tab Bar */}
          <div className="max-w-3xl mx-auto px-4 pb-2.5">
            <div className="flex gap-1 overflow-x-auto no-scrollbar p-1 bg-secondary/30 rounded-2xl">
              {views.map(tab => (
                <button key={tab.id} onClick={() => setActiveView(tab.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-300 ${
                    activeView === tab.id
                      ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}>
                  <tab.icon className={`w-3.5 h-3.5 ${activeView === tab.id && tab.glow ? "animate-pulse" : ""}`} />
                  {tab.label}
                  {tab.ai && (
                    <span className={`w-1.5 h-1.5 rounded-full ${activeView === tab.id ? "bg-primary-foreground" : "bg-primary"} animate-pulse`} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inline header with community title + tabs (matches HomeTab container) */}
      {inline && (
        <div className="px-5 pt-6 pb-2 max-w-lg mx-auto space-y-4">
          {/* Community Hero - matching HomeTab section style */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-3xl p-5 text-center"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "hsl(var(--primary))" }} />
            <div className="relative z-10 flex items-center justify-center gap-3 mb-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                  <Users className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  Community
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/15 to-accent/15 text-primary font-semibold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">Learn together, grow faster</p>
              </div>
            </div>
            <div className="relative z-10 flex items-center justify-center gap-3">
              {myKarma > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-warning/15 to-warning/5 border border-warning/20">
                  <Award className="w-3.5 h-3.5 text-warning" />
                  <span className="text-[10px] font-bold text-warning">{myKarma} karma</span>
                </div>
              )}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl shadow-lg shadow-primary/20 text-xs font-bold">
                <Plus className="w-3.5 h-3.5" /> New
              </motion.button>
            </div>
          </motion.section>

          {/* Tab bar matching HomeTab card style */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar p-1 rounded-2xl" style={{ background: "hsl(var(--secondary) / 0.3)" }}>
            {views.map(tab => (
              <button key={tab.id} onClick={() => setActiveView(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-300 ${
                  activeView === tab.id
                    ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}>
                <tab.icon className={`w-3.5 h-3.5 ${activeView === tab.id && tab.glow ? "animate-pulse" : ""}`} />
                {tab.label}
                {tab.ai && (
                  <span className={`w-1.5 h-1.5 rounded-full ${activeView === tab.id ? "bg-primary-foreground" : "bg-primary"} animate-pulse`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={inline ? "px-5 py-4 space-y-3 max-w-lg mx-auto pb-24" : "max-w-3xl mx-auto px-4 py-4 space-y-3 pb-24"}>
        {/* FEED VIEW */}
        {activeView === "feed" && (
          <>
            <div className="flex items-center gap-2 p-1 bg-secondary/20 rounded-xl">
              {([
                { id: "hot" as const, label: "Hot", icon: Flame, color: "text-destructive" },
                { id: "new" as const, label: "New", icon: Clock, color: "text-success" },
                { id: "top" as const, label: "Top", icon: TrendingUp, color: "text-primary" },
              ]).map(s => (
                <button key={s.id} onClick={() => setSortMode(s.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${
                    sortMode === s.id ? `bg-card border border-border/50 ${s.color} shadow-sm` : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <s.icon className="w-3.5 h-3.5" /> {s.label}
                </button>
              ))}
            </div>

            {loadingAI ? <LoadingState text="Loading feed..." /> :
              trendingPosts.length === 0 ? <EmptyState icon={Flame} text="No posts yet. Be the first to start a discussion!" /> :
              <div className="space-y-2.5">
                {trendingPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} showCommunity />)}
              </div>
            }
          </>
        )}

        {/* COMMUNITIES VIEW */}
        {activeView === "communities" && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search communities..."
                  className="w-full pl-9 pr-3 py-2.5 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all" />
              </div>
              <select value={filter} onChange={e => setFilter(e.target.value)}
                className="px-3 py-2 bg-card border border-border/50 rounded-xl text-xs text-foreground focus:outline-none">
                <option value="all">All</option>
                <option value="exam">Exam</option>
                <option value="subject">Subject</option>
                <option value="topic">Topic</option>
              </select>
            </div>

            {loading ? <LoadingState /> : filtered.length === 0 ? (
              <EmptyState icon={Users} text="No communities found" />
            ) : (
              <div className="space-y-3">
                {filtered.map((c, i) => {
                  const Icon = CATEGORY_ICONS[c.category] || Globe2;
                  const gradient = CATEGORY_GRADIENTS[c.category] || CATEGORY_GRADIENTS.general;
                  const isMember = myMemberships.has(c.id);
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 30 }}
                      className="group relative rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden"
                      onClick={() => navigate(`/community/${c.slug}`)}>
                      {/* Background gradient strip */}
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg group-hover:shadow-primary/10 transition-shadow`}>
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{c.name}</h3>
                              {c.exam_type && (
                                <span className="text-[8px] px-2 py-0.5 bg-gradient-to-r from-primary/15 to-primary/5 text-primary rounded-full font-bold uppercase tracking-wider">{c.exam_type}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{c.description || "A learning community"}</p>
                            <div className="flex items-center gap-3 mt-2.5">
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <div className="w-4 h-4 rounded-md bg-secondary flex items-center justify-center"><Users className="w-2.5 h-2.5" /></div>
                                {c.member_count}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <div className="w-4 h-4 rounded-md bg-secondary flex items-center justify-center"><MessageSquare className="w-2.5 h-2.5" /></div>
                                {c.post_count}
                              </span>
                              {(c.weekly_active_users || 0) > 0 && (
                                <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                                  <Zap className="w-3 h-3" />{c.weekly_active_users} active
                                </span>
                              )}
                              {(c.trending_score || 0) > 50 && (
                                <span className="flex items-center gap-1 text-[10px] text-destructive font-medium">
                                  <Flame className="w-3 h-3" /> Trending
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isMember ? (
                              <div className="flex items-center gap-1 px-3 py-1.5 bg-success/10 border border-success/20 text-success rounded-xl">
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="text-[10px] font-semibold">Joined</span>
                              </div>
                            ) : (
                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                onClick={e => { e.stopPropagation(); joinCommunity(c.id); }}
                                className="px-4 py-1.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl text-[10px] font-bold shadow-lg shadow-primary/15 hover:shadow-primary/30 transition-shadow">
                                Join
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* RECOMMENDED VIEW */}
        {activeView === "recommended" && (
          <div className="space-y-3">
            {/* AI Brain Banner */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 border border-primary/20 p-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
              <div className="relative flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                  <Brain className="w-5 h-5 text-primary-foreground animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">AI Personalized Feed</p>
                  <p className="text-[10px] text-muted-foreground">Curated based on your brain profile & weak topics</p>
                </div>
              </div>
              {weakTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {weakTopics.slice(0, 6).map(t => (
                    <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold border border-destructive/15">{t}</span>
                  ))}
                </div>
              )}
            </motion.div>

            {loadingAI ? <LoadingState text="AI finding discussions for you..." /> :
              recommendations.length === 0 ? <EmptyState icon={Brain} text="Study more topics to unlock personalized recommendations!" /> :
              recommendations.map((post, i) => (
                <motion.div key={post.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="group relative rounded-2xl bg-card/80 backdrop-blur-sm border border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/community/${post.community_id}`)}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shrink-0">
                        <Target className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary font-bold">
                            {post.relevance_score}% match
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-foreground mt-1 group-hover:text-primary transition-colors">{post.title}</h3>
                        {post.ai_summary && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{post.ai_summary}</p>}
                        {post.ai_tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {post.ai_tags.slice(0, 4).map((tag: string) => (
                              <span key={tag} className="text-[8px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium border border-accent/15">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            }
          </div>
        )}

        {/* IMPORTANT VIEW */}
        {activeView === "important" && (
          loadingAI ? <LoadingState text="Loading top discussions..." /> :
          importantPosts.length === 0 ? <EmptyState icon={Crown} text="No important discussions identified yet." /> :
          <div className="space-y-2.5">
            {importantPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
          </div>
        )}

        {/* SAVED VIEW */}
        {activeView === "saved" && (
          loadingAI ? <LoadingState /> :
          savedPosts.length === 0 ? <EmptyState icon={Bookmark} text="No saved posts yet. Bookmark discussions to find them here!" /> :
          <div className="space-y-2.5">
            {savedPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} showCommunity />)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateCommunityModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />}
      </AnimatePresence>
    </div>
  );
};

const LoadingState = ({ text = "Loading..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="relative">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
      <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-ping" />
    </div>
    <p className="text-xs text-muted-foreground font-medium">{text}</p>
  </div>
);

const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center mx-auto mb-4">
      <Icon className="w-7 h-7 text-muted-foreground" />
    </div>
    <p className="text-sm text-muted-foreground font-medium">{text}</p>
  </motion.div>
);

const CreateCommunityModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("exam");
  const [examType, setExamType] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [step, setStep] = useState(1);
  const [aiSuggestions, setAiSuggestions] = useState<{ description?: string; rules?: string[] } | null>(null);

  // AI suggestion states
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [examSuggestions, setExamSuggestions] = useState<{ name: string; full_name: string; emoji?: string }[]>([]);
  const [subjectSuggestions, setSubjectSuggestions] = useState<{ name: string; emoji?: string }[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<{ name: string; importance?: string }[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");

  const fetchNameSuggestions = async () => {
    setLoadingNames(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "suggest_names", category, exam_type: examType, subject, partial: name.trim() }
      });
      setNameSuggestions(res.data?.names || []);
    } catch { /* ignore */ }
    setLoadingNames(false);
  };

  const fetchExamSuggestions = async () => {
    if (examSuggestions.length > 0) return;
    setLoadingExams(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "suggest_exam_types" }
      });
      setExamSuggestions(res.data?.exams || []);
    } catch { /* ignore */ }
    setLoadingExams(false);
  };

  const fetchSubjectSuggestions = async () => {
    setLoadingSubjects(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "suggest_subjects", exam_type: examType }
      });
      setSubjectSuggestions(res.data?.subjects || []);
    } catch { /* ignore */ }
    setLoadingSubjects(false);
  };

  const fetchTopicSuggestions = async () => {
    if (!subject) return;
    setLoadingTopics(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "suggest_topics", subject, exam_type: examType }
      });
      setTopicSuggestions(res.data?.topics || []);
    } catch { /* ignore */ }
    setLoadingTopics(false);
  };

  // Auto-load exam suggestions when category is exam
  useEffect(() => {
    if (category === "exam") fetchExamSuggestions();
    if (category === "subject") fetchSubjectSuggestions();
  }, [category]);

  // Load subjects when exam type changes
  useEffect(() => {
    if (examType) fetchSubjectSuggestions();
  }, [examType]);

  // Load topics when subject changes
  useEffect(() => {
    if (subject) fetchTopicSuggestions();
  }, [subject]);

  const generateAIDescription = async () => {
    if (!name.trim()) { toast({ title: "Enter a name first" }); return; }
    setAiGenerating(true);
    try {
      const res = await supabase.functions.invoke("ai-community-assist", {
        body: { action: "suggest_community", name: name.trim(), category, exam_type: examType, subject }
      });
      if (res.data?.description) {
        setDescription(res.data.description);
        setAiSuggestions({ description: res.data.description, rules: res.data.rules || [] });
      }
    } catch {
      const desc = `A community for ${category === "exam" ? examType || "exam" : category === "subject" ? subject || "subject" : category} enthusiasts. Discuss strategies, share resources, and learn together.`;
      setDescription(desc);
    }
    setAiGenerating(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const rules = aiSuggestions?.rules?.length ? aiSuggestions.rules.map((r, i) => ({ order: i + 1, text: r })) : null;
    const { error } = await supabase.from("communities").insert({
      name: name.trim(), description: description.trim(), slug, category,
      exam_type: examType || null, subject: subject || null, created_by: user.id, is_approved: false,
      rules: rules ? JSON.parse(JSON.stringify(rules)) : null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
    toast({ title: "Community Created! 🎉", description: "Pending admin approval." });
    onCreated();
  };

  const categories = [
    { value: "exam", label: "Exam", icon: GraduationCap, desc: "JEE, NEET, UPSC..." },
    { value: "subject", label: "Subject", icon: Atom, desc: "Physics, Chemistry..." },
    { value: "topic", label: "Topic", icon: BookOpen, desc: "Specific topic" },
    { value: "general", label: "General", icon: Globe2, desc: "Open discussion" },
  ];

  const SuggestionChips = ({ items, onSelect, loading: isLoading, label, icon: SIcon }: { items: string[]; onSelect: (v: string) => void; loading: boolean; label: string; icon: any }) => (
    items.length > 0 || isLoading ? (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <SIcon className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-bold text-primary uppercase tracking-wider">{label}</span>
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <motion.button key={item} type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(item)}
              className="px-3 py-1.5 rounded-xl text-[10px] font-semibold bg-gradient-to-r from-primary/10 to-accent/10 text-primary border border-primary/15 hover:border-primary/40 hover:from-primary/20 hover:to-accent/20 transition-all">
              {item}
            </motion.button>
          ))}
        </div>
      </motion.div>
    ) : null
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-end sm:items-center justify-center" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-lg bg-card border border-border/50 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-primary/5"
        onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/30 px-5 py-4 flex items-center gap-3 z-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Plus className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-foreground">Create Community</h2>
            <p className="text-[10px] text-muted-foreground">Step {step} of 2 — {step === 1 ? "Basic Info" : "Details & AI Setup"}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-xl transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-5">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {/* Category Selector */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-2 block">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map(cat => (
                      <button key={cat.value} onClick={() => { setCategory(cat.value); setExamType(""); setSubject(""); setSelectedTopic(""); }}
                        className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                          category === cat.value
                            ? "border-primary/50 bg-primary/10 shadow-md shadow-primary/5"
                            : "border-border/50 bg-secondary/20 hover:bg-secondary/40 hover:border-border"
                        }`}>
                        <div className="flex items-center gap-2">
                          <cat.icon className={`w-4 h-4 ${category === cat.value ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-semibold ${category === cat.value ? "text-primary" : "text-foreground"}`}>{cat.label}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">{cat.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exam Type - AI Suggestions */}
                {category === "exam" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">Exam Type</label>
                      <span className="text-[9px] text-primary flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Suggested</span>
                    </div>
                    {loadingExams ? (
                      <div className="flex items-center gap-2 py-3"><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-xs text-muted-foreground">Loading suggestions...</span></div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(examSuggestions.length > 0 ? examSuggestions : [
                          { name: "JEE", full_name: "Joint Entrance Exam", emoji: "🎯" },
                          { name: "NEET", full_name: "Medical Entrance", emoji: "🏥" },
                          { name: "UPSC", full_name: "Civil Services", emoji: "🏛️" },
                          { name: "SSC", full_name: "Staff Selection", emoji: "📋" },
                          { name: "GATE", full_name: "Graduate Aptitude Test", emoji: "⚙️" },
                          { name: "CAT", full_name: "Common Admission Test", emoji: "📊" },
                        ]).map(ex => (
                          <motion.button key={ex.name} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setExamType(ex.name)}
                            className={`px-3 py-2 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                              examType === ex.name
                                ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                                : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/30"
                            }`}>
                            <span>{ex.emoji || "📝"}</span>
                            <div className="text-left">
                              <div>{ex.name}</div>
                              {ex.full_name && <div className="text-[8px] opacity-70 font-normal">{ex.full_name}</div>}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                    <input value={examType} onChange={e => setExamType(e.target.value)} placeholder="Or type custom exam..."
                      className="w-full mt-2 px-4 py-2.5 bg-secondary/30 border border-border/50 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                  </div>
                )}

                {/* Subject - AI Suggestions */}
                {(category === "subject" || (category === "exam" && examType)) && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">{category === "exam" ? "Subject (optional)" : "Subject"}</label>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={fetchSubjectSuggestions} disabled={loadingSubjects}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold text-primary hover:bg-primary/10 transition-all">
                        {loadingSubjects ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh
                      </motion.button>
                    </div>
                    {loadingSubjects ? (
                      <div className="flex items-center gap-2 py-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-xs text-muted-foreground">AI suggesting subjects...</span></div>
                    ) : subjectSuggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {subjectSuggestions.map(s => (
                          <motion.button key={s.name} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setSubject(s.name)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all ${
                              subject === s.name
                                ? "bg-gradient-to-r from-accent to-accent/90 text-accent-foreground shadow-md"
                                : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/30"
                            }`}>
                            {s.emoji || "📚"} {s.name}
                          </motion.button>
                        ))}
                      </div>
                    ) : null}
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Physics, Chemistry"
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border/50 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                  </div>
                )}

                {/* Topic Suggestions */}
                {category === "topic" && (
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Subject (for topic suggestions)</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Physics"
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border/50 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                    {(topicSuggestions.length > 0 || loadingTopics) && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Lightbulb className="w-3 h-3 text-primary" />
                          <span className="text-[9px] font-bold text-primary uppercase tracking-wider">AI Topic Suggestions</span>
                          {loadingTopics && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {topicSuggestions.map(t => (
                            <motion.button key={t.name} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                              onClick={() => { setSelectedTopic(t.name); setName(t.name); }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all border ${
                                selectedTopic === t.name
                                  ? "bg-primary/15 border-primary/40 text-primary"
                                  : "bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/20"
                              }`}>
                              {t.name}
                              {t.importance === "high" && <Flame className="w-3 h-3 text-destructive inline ml-1" />}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Name with AI suggestions */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground">Community Name</label>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={fetchNameSuggestions} disabled={loadingNames}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] font-semibold hover:from-primary/25 hover:to-accent/25 transition-all disabled:opacity-50">
                      {loadingNames ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      AI Suggest Names
                    </motion.button>
                  </div>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. JEE Physics Champions"
                    className="w-full px-4 py-3 bg-secondary/30 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all" />
                  <SuggestionChips items={nameSuggestions} onSelect={setName} loading={loadingNames} label="AI Name Ideas" icon={Sparkles} />
                </div>

                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => setStep(2)} disabled={!name.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/15">
                  Continue <ChevronRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-3 h-3" /> Back
                </button>

                {/* Description with AI */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-foreground">Description</label>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={generateAIDescription} disabled={aiGenerating}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-primary/15 to-accent/15 text-primary text-[10px] font-semibold hover:from-primary/25 hover:to-accent/25 transition-all disabled:opacity-50">
                      {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      AI Generate
                    </motion.button>
                  </div>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your community..." rows={3}
                    className="w-full px-4 py-3 bg-secondary/30 border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
                </div>

                {/* AI Suggested Rules */}
                {aiSuggestions?.rules && aiSuggestions.rules.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/15 p-3.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-bold text-primary">AI Suggested Rules</span>
                    </div>
                    {aiSuggestions.rules.map((rule, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                        <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                        <span>{rule}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Preview */}
                <div className="rounded-xl bg-card border border-border/50 p-4">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Preview</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                      {(() => { const I = CATEGORY_ICONS[category] || Globe2; return <I className="w-5 h-5 text-primary" />; })()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{name || "Community Name"}</h4>
                      <p className="text-[10px] text-muted-foreground">{description || "Description will appear here"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {examType && <span className="text-[8px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{examType}</span>}
                    {subject && <span className="text-[8px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">{subject}</span>}
                    {selectedTopic && <span className="text-[8px] px-2 py-0.5 rounded-full bg-warning/10 text-warning font-semibold">{selectedTopic}</span>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-secondary transition-colors font-medium">Cancel</button>
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={handleCreate} disabled={!name.trim() || loading}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Create Community
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
export default CommunityPage;
