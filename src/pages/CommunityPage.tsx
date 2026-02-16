import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, BookOpen, ArrowLeft, Loader2,
  GraduationCap, Atom, Calculator, Beaker, Globe2,
  MessageSquare, TrendingUp, ChevronRight, Filter
} from "lucide-react";

const CATEGORY_ICONS: Record<string, any> = {
  exam: GraduationCap, subject: Atom, topic: BookOpen, general: Globe2,
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/app")} className="p-2 hover:bg-secondary rounded-lg"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Communities
            </h1>
            <p className="text-[10px] text-muted-foreground">Learn together, grow together</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Search & Filter */}
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

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No communities found</p>
          </div>
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
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.member_count} members</span>
                        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{c.post_count} posts</span>
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
      </div>

      {/* Create Community Modal */}
      <AnimatePresence>
        {showCreate && <CreateCommunityModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />}
      </AnimatePresence>
    </div>
  );
};

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
      exam_type: examType || null, subject: subject || null, created_by: user.id,
      is_approved: false,
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
            <option value="JEE">JEE</option>
            <option value="NEET">NEET</option>
            <option value="UPSC">UPSC</option>
            <option value="SSC">SSC</option>
            <option value="GATE">GATE</option>
            <option value="CAT">CAT</option>
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
