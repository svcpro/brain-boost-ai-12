import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, Loader2, RefreshCw, TrendingUp, Users, MessageSquare,
  Flame, Crown, Calendar
} from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

interface DailyActivity {
  date: string;
  posts: number;
  comments: number;
}

interface TopContributor {
  user_id: string;
  display_name: string;
  post_count: number;
  comment_count: number;
}

const CommunityAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<14 | 30 | 90>(30);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [moderationStats, setModerationStats] = useState({
    totalFlags: 0, autoHidden: 0, dismissed: 0, actioned: 0,
    avgAbuseScore: 0, warningsIssued: 0, bansIssued: 0,
  });

  const fetchAll = async () => {
    setLoading(true);
    const since = subDays(new Date(), range).toISOString();
    const days = eachDayOfInterval({ start: subDays(new Date(), range), end: new Date() });

    const [postsRes, commentsRes, flagsRes, actionsRes] = await Promise.all([
      supabase.from("community_posts").select("created_at").gte("created_at", since).eq("is_deleted", false),
      (supabase as any).from("post_comments").select("created_at").gte("created_at", since).eq("is_deleted", false),
      (supabase as any).from("content_flags").select("abuse_score, status, auto_hidden").gte("created_at", since),
      (supabase as any).from("moderation_actions").select("action_type").gte("created_at", since),
    ]);

    // Daily activity
    const postsByDay: Record<string, number> = {};
    const commentsByDay: Record<string, number> = {};
    days.forEach(d => {
      const key = format(d, "MMM dd");
      postsByDay[key] = 0;
      commentsByDay[key] = 0;
    });
    (postsRes.data || []).forEach((p: any) => {
      const key = format(new Date(p.created_at), "MMM dd");
      if (postsByDay[key] !== undefined) postsByDay[key]++;
    });
    (commentsRes.data || []).forEach((c: any) => {
      const key = format(new Date(c.created_at), "MMM dd");
      if (commentsByDay[key] !== undefined) commentsByDay[key]++;
    });
    setDailyActivity(days.map(d => {
      const key = format(d, "MMM dd");
      return { date: key, posts: postsByDay[key] || 0, comments: commentsByDay[key] || 0 };
    }));

    // Moderation stats
    const flags = flagsRes.data || [];
    const actions = actionsRes.data || [];
    setModerationStats({
      totalFlags: flags.length,
      autoHidden: flags.filter((f: any) => f.auto_hidden).length,
      dismissed: flags.filter((f: any) => f.status === "dismissed").length,
      actioned: flags.filter((f: any) => f.status === "actioned").length,
      avgAbuseScore: flags.length ? Math.round(flags.reduce((s: number, f: any) => s + f.abuse_score, 0) / flags.length) : 0,
      warningsIssued: actions.filter((a: any) => a.action_type === "warning").length,
      bansIssued: actions.filter((a: any) => ["temporary_ban", "community_ban", "account_suspension"].includes(a.action_type)).length,
    });

    // Top contributors
    const { data: topPosts } = await supabase.from("community_posts")
      .select("user_id").gte("created_at", since).eq("is_deleted", false);
    const userPostCounts: Record<string, number> = {};
    (topPosts || []).forEach((p: any) => { userPostCounts[p.user_id] = (userPostCounts[p.user_id] || 0) + 1; });
    const topUserIds = Object.entries(userPostCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);

    if (topUserIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", topUserIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.id] = p.display_name || "Unknown"; });
      setTopContributors(topUserIds.map(id => ({
        user_id: id,
        display_name: nameMap[id] || id.slice(0, 8),
        post_count: userPostCounts[id],
        comment_count: 0,
      })));
    } else {
      setTopContributors([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [range]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Community Analytics</h3>
        <div className="flex items-center gap-2">
          {([14, 30, 90] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${range === r ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground"}`}>
              {r}d
            </button>
          ))}
          <button onClick={fetchAll} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Moderation Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Flame, label: "Total Flags", value: moderationStats.totalFlags, color: "bg-destructive/15 text-destructive" },
          { icon: BarChart3, label: "Avg Abuse Score", value: moderationStats.avgAbuseScore, color: "bg-warning/15 text-warning" },
          { icon: Users, label: "Warnings Issued", value: moderationStats.warningsIssued, color: "bg-orange-500/15 text-orange-400" },
          { icon: TrendingUp, label: "Bans Issued", value: moderationStats.bansIssued, color: "bg-destructive/15 text-destructive" },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Chart */}
      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-sm font-semibold text-foreground mb-4">Daily Activity</h4>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={Math.floor(dailyActivity.length / 7)} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="posts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Posts" />
              <Bar dataKey="comments" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Comments" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Moderation Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4 neural-border">
          <h4 className="text-sm font-semibold text-foreground mb-3">Flag Resolution</h4>
          <div className="space-y-2">
            {[
              { label: "Auto-hidden", value: moderationStats.autoHidden, color: "bg-destructive" },
              { label: "Manually actioned", value: moderationStats.actioned, color: "bg-warning" },
              { label: "Dismissed (safe)", value: moderationStats.dismissed, color: "bg-success" },
              { label: "Pending review", value: moderationStats.totalFlags - moderationStats.autoHidden - moderationStats.actioned - moderationStats.dismissed, color: "bg-primary" },
            ].map((item, i) => {
              const pct = moderationStats.totalFlags ? Math.round((item.value / moderationStats.totalFlags) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32 shrink-0">{item.label}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-12 text-right">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Contributors */}
        <div className="glass rounded-xl p-4 neural-border">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Crown className="w-4 h-4 text-warning" /> Top Contributors
          </h4>
          {topContributors.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity in this period</p>
          ) : (
            <div className="space-y-2">
              {topContributors.map((c, i) => (
                <div key={c.user_id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary w-5">#{i + 1}</span>
                    <span className="text-sm text-foreground">{c.display_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.post_count} posts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityAnalytics;
