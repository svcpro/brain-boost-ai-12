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
  BarChart3, Filter, ArrowUpRight, Hash
} from "lucide-react";

const CATEGORY_ICONS: Record<string, any> = {
  exam: GraduationCap, subject: Atom, topic: BookOpen, general: Globe2,
};

const REPUTATION_BADGES: Record<string, { label: string; icon: any; cls: string }> = {
  legend: { label: "Legend", icon: Crown, cls: "text-warning" },
  expert: { label: "Expert", icon: Award, cls: "text-primary" },
  contributor: { label: "Contributor", icon: Star, cls: "text-accent" },
  active: { label: "Active", icon: Zap, cls: "text-success" },
  newbie: { label: "Newbie", icon: Users, cls: "text-muted-foreground" },
};

const CommunityPage = () => {
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

  // Fetch karma
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("user_reputation").select("karma_points").eq("user_id", user.id).maybeSingle().then(({ data }: any) => {
      if (data) setMyKarma(data.karma_points || 0);
    });
  }, [user]);

  // Fetch trending feed
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
      <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
        className={`glass rounded-xl p-4 neural-border hover:border-primary/40 transition-all cursor-pointer border-l-[3px] ${impCls}`}
        onClick={() => {
          const slug = post.communities?.slug;
          if (slug) navigate(`/community/${slug}`);
        }}>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 shrink-0 min-w-[32px]">
            <button className="text-primary hover:text-primary/80"><TrendingUp className="w-4 h-4" /></button>
            <span className="text-xs font-bold text-foreground">{post.upvote_count || 0}</span>
          </div>
          <div className="flex-1 min-w-0">
            {showCommunity && post.communities && (
              <div className="flex items-center gap-1.5 mb-1">
                <Hash className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-primary font-medium">{post.communities.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{post.post_type}</span>
              {post.importance_level === "high" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">🔥 Hot</span>}
              {post.is_pinned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">📌</span>}
              {post.ai_summary && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">🤖 AI</span>}
            </div>
            <h3 className="text-sm font-semibold text-foreground mt-1 line-clamp-2">{post.title}</h3>
            {post.ai_summary && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{post.ai_summary}</p>}
            {post.ai_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {post.ai_tags.slice(0, 3).map((tag: string) => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{tag}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comment_count || 0}</span>
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count || 0}</span>
              {post.importance_score > 0 && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{post.importance_score}</span>}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />
        </div>
      </motion.div>
    );
  };

  const views = [
    { id: "feed" as const, label: "Feed", icon: Flame },
    { id: "communities" as const, label: "Browse", icon: Users },
    { id: "recommended" as const, label: "For You", icon: Brain },
    { id: "important" as const, label: "Top", icon: Star },
    { id: "saved" as const, label: "Saved", icon: Bookmark },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/app")} className="p-2 hover:bg-secondary rounded-lg"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Users className="w-4 h-4 text-primary-foreground" />
              </div>
              Community
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {myKarma > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/20">
                <Award className="w-3 h-3 text-warning" />
                <span className="text-[10px] font-bold text-warning">{myKarma}</span>
              </div>
            )}
            <button onClick={() => setShowCreate(true)} className="p-2.5 bg-primary text-primary-foreground rounded-xl">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-3xl mx-auto px-4 pb-2">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {views.map(tab => (
              <button key={tab.id} onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  activeView === tab.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}>
                <tab.icon className={`w-3.5 h-3.5 ${activeView === tab.id && tab.id === "feed" ? "animate-pulse" : ""}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {/* FEED VIEW */}
        {activeView === "feed" && (
          <>
            {/* Sort Tabs */}
            <div className="flex items-center gap-2">
              {([
                { id: "hot" as const, label: "Hot", icon: Flame },
                { id: "new" as const, label: "New", icon: Clock },
                { id: "top" as const, label: "Top", icon: TrendingUp },
              ]).map(s => (
                <button key={s.id} onClick={() => setSortMode(s.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    sortMode === s.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <s.icon className="w-3.5 h-3.5" /> {s.label}
                </button>
              ))}
            </div>

            {loadingAI ? (
              <LoadingState text="Loading feed..." />
            ) : trendingPosts.length === 0 ? (
              <EmptyState icon={Flame} text="No posts yet. Be the first to start a discussion!" />
            ) : (
              trendingPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} showCommunity />)
            )}
          </>
        )}

        {/* COMMUNITIES VIEW */}
        {activeView === "communities" && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search communities..."
                  className="w-full pl-9 pr-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <select value={filter} onChange={e => setFilter(e.target.value)}
                className="px-3 py-2 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none">
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
                  const isMember = myMemberships.has(c.id);
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="glass rounded-xl p-4 neural-border hover:border-primary/40 transition-all cursor-pointer"
                      onClick={() => navigate(`/community/${c.slug}`)}>
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground truncate">{c.name}</h3>
                            {c.exam_type && <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{c.exam_type}</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{c.description || "A learning community"}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.member_count}</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{c.post_count}</span>
                            {(c.weekly_active_users || 0) > 0 && <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-success" />{c.weekly_active_users} active</span>}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isMember ? (
                            <span className="text-[10px] px-2.5 py-1 bg-success/15 text-success rounded-full font-medium">Joined</span>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); joinCommunity(c.id); }}
                              className="text-[10px] px-2.5 py-1 bg-primary text-primary-foreground rounded-full font-medium hover:bg-primary/90">
                              Join
                            </button>
                          )}
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
            {weakTopics.length > 0 && (
              <div className="glass rounded-xl p-3 neural-border">
                <p className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1"><Brain className="w-3 h-3 text-primary" /> Personalized based on your weak topics:</p>
                <div className="flex flex-wrap gap-1.5">
                  {weakTopics.slice(0, 8).map(t => (
                    <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {loadingAI ? <LoadingState text="AI finding discussions for you..." /> :
              recommendations.length === 0 ? <EmptyState icon={Brain} text="Study more topics to unlock personalized recommendations!" /> :
              recommendations.map((post, i) => (
                <motion.div key={post.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-4 neural-border hover:border-primary/40 transition-all cursor-pointer border-l-[3px] border-l-primary"
                  onClick={() => navigate(`/community/${post.community_id}`)}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                          {post.relevance_score}% match
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground mt-1">{post.title}</h3>
                      {post.ai_summary && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{post.ai_summary}</p>}
                      {post.ai_tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {post.ai_tags.slice(0, 4).map((tag: string) => (
                            <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{tag}</span>
                          ))}
                        </div>
                      )}
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
          importantPosts.length === 0 ? <EmptyState icon={Star} text="No important discussions identified yet." /> :
          importantPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
        )}

        {/* SAVED VIEW */}
        {activeView === "saved" && (
          loadingAI ? <LoadingState /> :
          savedPosts.length === 0 ? <EmptyState icon={Bookmark} text="No saved posts yet. Bookmark discussions to find them here!" /> :
          savedPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} showCommunity />)
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateCommunityModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />}
      </AnimatePresence>
    </div>
  );
};

const LoadingState = ({ text = "Loading..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-2">
    <Loader2 className="w-6 h-6 animate-spin text-primary" />
    <p className="text-xs text-muted-foreground">{text}</p>
  </div>
);

const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
  <div className="text-center py-12">
    <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
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

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setLoading(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const { error } = await supabase.from("communities").insert({
      name: name.trim(), description: description.trim(), slug, category,
      exam_type: examType || null, subject: subject || null, created_by: user.id, is_approved: false,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
    toast({ title: "Community Created! 🎉", description: "Pending admin approval." });
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md glass rounded-2xl neural-border p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">Create Community</h2>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Community name"
          className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3}
          className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none">
          <option value="exam">Exam-based</option>
          <option value="subject">Subject-based</option>
          <option value="topic">Topic-based</option>
          <option value="general">General</option>
        </select>
        {category === "exam" && (
          <select value={examType} onChange={e => setExamType(e.target.value)}
            className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none">
            <option value="">Select exam</option>
            <option value="JEE">JEE</option><option value="NEET">NEET</option><option value="UPSC">UPSC</option>
            <option value="SSC">SSC</option><option value="GATE">GATE</option><option value="CAT">CAT</option>
          </select>
        )}
        {category === "subject" && (
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject name (e.g. Physics)"
            className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={!name.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CommunityPage;
