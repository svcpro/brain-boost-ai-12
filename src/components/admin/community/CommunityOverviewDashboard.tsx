import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, MessageSquare, TrendingUp, AlertTriangle, BarChart3,
  Loader2, RefreshCw, Eye, Shield, Flame
} from "lucide-react";
import { format, subDays, startOfDay, startOfWeek, startOfMonth } from "date-fns";

interface DashboardStats {
  totalCommunities: number;
  totalPosts: number;
  totalComments: number;
  activeUsers: number;
  postsToday: number;
  postsThisWeek: number;
  postsThisMonth: number;
  flaggedContent: number;
  pinnedPosts: number;
  deletedPosts: number;
  pendingCommunities: number;
  topCommunities: { name: string; post_count: number; member_count: number }[];
}

const StatCard = ({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: number | string; color: string; sub?: string }) => (
  <div className="glass rounded-xl p-4 neural-border">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{typeof value === "number" ? value.toLocaleString() : value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-primary">{sub}</p>}
      </div>
    </div>
  </div>
);

const CommunityOverviewDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const monthStart = startOfMonth(now).toISOString();

    const [
      commRes, postRes, commentRes, pinnedRes, deletedRes, pendingRes,
      postsTodayRes, postsWeekRes, postsMonthRes, flaggedRes, topRes, activeRes,
    ] = await Promise.all([
      supabase.from("communities").select("*", { count: "exact", head: true }),
      supabase.from("community_posts").select("*", { count: "exact", head: true }).eq("is_deleted", false),
      supabase.from("post_comments").select("*", { count: "exact", head: true }).eq("is_deleted", false),
      supabase.from("community_posts").select("*", { count: "exact", head: true }).eq("is_pinned", true),
      supabase.from("community_posts").select("*", { count: "exact", head: true }).eq("is_deleted", true),
      supabase.from("communities").select("*", { count: "exact", head: true }).eq("is_approved", false),
      supabase.from("community_posts").select("*", { count: "exact", head: true }).gte("created_at", todayStart).eq("is_deleted", false),
      supabase.from("community_posts").select("*", { count: "exact", head: true }).gte("created_at", weekStart).eq("is_deleted", false),
      supabase.from("community_posts").select("*", { count: "exact", head: true }).gte("created_at", monthStart).eq("is_deleted", false),
      supabase.from("community_posts").select("*", { count: "exact", head: true }).not("importance_level", "is", null),
      supabase.from("communities").select("name, post_count, member_count").eq("is_approved", true).order("post_count", { ascending: false }).limit(5),
      supabase.from("community_posts").select("user_id").gte("created_at", subDays(now, 7).toISOString()).eq("is_deleted", false),
    ]);

    const uniqueUsers = new Set((activeRes.data || []).map((p: any) => p.user_id));

    setStats({
      totalCommunities: commRes.count ?? 0,
      totalPosts: postRes.count ?? 0,
      totalComments: commentRes.count ?? 0,
      activeUsers: uniqueUsers.size,
      postsToday: postsTodayRes.count ?? 0,
      postsThisWeek: postsWeekRes.count ?? 0,
      postsThisMonth: postsMonthRes.count ?? 0,
      flaggedContent: flaggedRes.count ?? 0,
      pinnedPosts: pinnedRes.count ?? 0,
      deletedPosts: deletedRes.count ?? 0,
      pendingCommunities: pendingRes.count ?? 0,
      topCommunities: topRes.data || [],
    });
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Community Overview</h3>
        <button onClick={fetchStats} className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Communities" value={stats.totalCommunities} color="bg-primary/15 text-primary" />
        <StatCard icon={MessageSquare} label="Total Posts" value={stats.totalPosts} color="bg-accent/15 text-accent" />
        <StatCard icon={MessageSquare} label="Total Comments" value={stats.totalComments} color="bg-blue-500/15 text-blue-400" />
        <StatCard icon={Eye} label="Active Users (7d)" value={stats.activeUsers} color="bg-success/15 text-success" />
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Flame} label="Posts Today" value={stats.postsToday} color="bg-warning/15 text-warning" />
        <StatCard icon={TrendingUp} label="Posts This Week" value={stats.postsThisWeek} color="bg-primary/15 text-primary" />
        <StatCard icon={BarChart3} label="Posts This Month" value={stats.postsThisMonth} color="bg-accent/15 text-accent" />
      </div>

      {/* Moderation Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={AlertTriangle} label="Flagged Content" value={stats.flaggedContent} color="bg-destructive/15 text-destructive" />
        <StatCard icon={Shield} label="Pending Communities" value={stats.pendingCommunities} color="bg-warning/15 text-warning" />
        <StatCard icon={TrendingUp} label="Pinned Posts" value={stats.pinnedPosts} color="bg-success/15 text-success" />
        <StatCard icon={AlertTriangle} label="Deleted Posts" value={stats.deletedPosts} color="bg-muted text-muted-foreground" />
      </div>

      {/* Top Communities */}
      {stats.topCommunities.length > 0 && (
        <div className="glass rounded-xl p-4 neural-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">Top Communities</h4>
          <div className="space-y-2">
            {stats.topCommunities.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary w-5">#{i + 1}</span>
                  <span className="text-sm text-foreground">{c.name}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{c.member_count} members</span>
                  <span>{c.post_count} posts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityOverviewDashboard;
