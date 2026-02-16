import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Search, RefreshCw, Loader2, Eye, EyeOff,
  TrendingUp, Flame, Clock, Crown, Medal, Award, BarChart3,
  Shield, Settings, ChevronDown, ChevronUp, Ban, CheckCircle2,
  Download, Filter, ArrowUpDown, Percent, Target, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

type TabKey = "overview" | "participants" | "analytics" | "settings";

interface LeaderboardUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  opt_in_leaderboard: boolean;
  is_banned: boolean;
  predicted_rank: number;
  percentile: number;
  streak: number;
  total_study_hours: number;
  last_active: string | null;
}

const LeaderboardManagement = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [stats, setStats] = useState({
    totalParticipants: 0,
    optedIn: 0,
    optedOut: 0,
    avgStreak: 0,
    avgStudyHours: 0,
    topStreak: 0,
    topStudyHours: 0,
    avgPercentile: 0,
  });
  const [sortBy, setSortBy] = useState<"rank" | "streak" | "hours" | "percentile">("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");

  // Settings state
  const [maxLeaderboardSize, setMaxLeaderboardSize] = useState(50);
  const [anonymizeNames, setAnonymizeNames] = useState(true);
  const [showStreaks, setShowStreaks] = useState(true);
  const [showStudyHours, setShowStudyHours] = useState(true);
  const [showPercentile, setShowPercentile] = useState(true);
  const [allowFreezeGifts, setAllowFreezeGifts] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Get all profiles with leaderboard-relevant data
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, opt_in_leaderboard, is_banned, daily_study_goal_minutes");

      // Get latest rank predictions
      const { data: ranks } = await supabase
        .from("rank_predictions")
        .select("user_id, predicted_rank, percentile, recorded_at")
        .order("recorded_at", { ascending: false });

      // Get study logs from last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const { data: logs } = await supabase
        .from("study_logs")
        .select("user_id, duration_minutes, created_at")
        .gte("created_at", ninetyDaysAgo.toISOString());

      // Deduplicate ranks
      const latestRanks = new Map<string, { predicted_rank: number; percentile: number; recorded_at: string }>();
      for (const r of (ranks || [])) {
        if (!latestRanks.has(r.user_id)) latestRanks.set(r.user_id, r);
      }

      // Calculate hours and streaks per user
      const userHours = new Map<string, number>();
      const userLastActive = new Map<string, string>();
      const userDayTotals = new Map<string, Map<string, number>>();

      for (const log of (logs || [])) {
        userHours.set(log.user_id, (userHours.get(log.user_id) || 0) + (log.duration_minutes || 0));
        const existing = userLastActive.get(log.user_id);
        if (!existing || log.created_at > existing) userLastActive.set(log.user_id, log.created_at);

        const dateStr = log.created_at.split("T")[0];
        if (!userDayTotals.has(log.user_id)) userDayTotals.set(log.user_id, new Map());
        const dayMap = userDayTotals.get(log.user_id)!;
        dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + (log.duration_minutes || 0));
      }

      // Calculate streaks
      const userStreaks = new Map<string, number>();
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (const [uid, dayMap] of userDayTotals) {
        const profile = (profiles || []).find(p => p.id === uid);
        const dailyGoal = profile?.daily_study_goal_minutes || 60;
        let streak = 0;
        for (let i = 0; i < 90; i++) {
          const checkDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = checkDate.toISOString().split("T")[0];
          const dayTotal = dayMap.get(dateStr) || 0;
          if (i === 0 && dayTotal < dailyGoal) continue;
          if (dayTotal >= dailyGoal) streak++;
          else if (i > 0) break;
        }
        userStreaks.set(uid, streak);
      }

      // Build user list
      const allUsers: LeaderboardUser[] = (profiles || []).map(p => {
        const rank = latestRanks.get(p.id);
        const hours = Math.round((userHours.get(p.id) || 0) / 60 * 10) / 10;
        return {
          user_id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          opt_in_leaderboard: p.opt_in_leaderboard,
          is_banned: p.is_banned,
          predicted_rank: rank?.predicted_rank || 99999,
          percentile: rank?.percentile || 0,
          streak: userStreaks.get(p.id) || 0,
          total_study_hours: hours,
          last_active: userLastActive.get(p.id) || null,
        };
      });

      setUsers(allUsers);

      // Stats
      const opted = allUsers.filter(u => u.opt_in_leaderboard);
      const withRanks = allUsers.filter(u => u.predicted_rank < 99999);
      setStats({
        totalParticipants: withRanks.length,
        optedIn: opted.length,
        optedOut: allUsers.length - opted.length,
        avgStreak: withRanks.length > 0 ? Math.round(withRanks.reduce((s, u) => s + u.streak, 0) / withRanks.length * 10) / 10 : 0,
        avgStudyHours: withRanks.length > 0 ? Math.round(withRanks.reduce((s, u) => s + u.total_study_hours, 0) / withRanks.length * 10) / 10 : 0,
        topStreak: Math.max(...allUsers.map(u => u.streak), 0),
        topStudyHours: Math.max(...allUsers.map(u => u.total_study_hours), 0),
        avgPercentile: withRanks.length > 0 ? Math.round(withRanks.reduce((s, u) => s + (u.percentile || 0), 0) / withRanks.length) : 0,
      });
    } catch (e) {
      console.error("Leaderboard admin error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleUserVisibility = async (userId: string, current: boolean) => {
    const next = !current;
    await supabase.from("profiles").update({ opt_in_leaderboard: next }).eq("id", userId);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, opt_in_leaderboard: next } : u));
    toast({ title: next ? "User visible on leaderboard" : "User hidden from leaderboard" });
  };

  const resetUserRank = async (userId: string) => {
    await supabase.from("rank_predictions").delete().eq("user_id", userId);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, predicted_rank: 99999, percentile: 0 } : u));
    toast({ title: "Rank data reset for user" });
  };

  const exportLeaderboard = () => {
    const sorted = getSortedUsers();
    const csv = [
      "Rank,Display Name,Predicted Rank,Percentile,Streak,Study Hours,Visible,Last Active",
      ...sorted.map((u, i) =>
        `${i + 1},"${u.display_name || 'Anonymous'}",${u.predicted_rank === 99999 ? 'N/A' : u.predicted_rank},${u.percentile}%,${u.streak},${u.total_study_hours},${u.opt_in_leaderboard ? 'Yes' : 'No'},${u.last_active ? format(new Date(u.last_active), "yyyy-MM-dd") : 'Never'}`
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Leaderboard exported" });
  };

  const getSortedUsers = () => {
    let filtered = users.filter(u => {
      if (filterVisibility === "visible") return u.opt_in_leaderboard;
      if (filterVisibility === "hidden") return !u.opt_in_leaderboard;
      return true;
    });
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u => (u.display_name || "").toLowerCase().includes(q) || u.user_id.includes(q));
    }
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "rank") cmp = a.predicted_rank - b.predicted_rank;
      else if (sortBy === "streak") cmp = b.streak - a.streak;
      else if (sortBy === "hours") cmp = b.total_study_hours - a.total_study_hours;
      else if (sortBy === "percentile") cmp = b.percentile - a.percentile;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return filtered;
  };

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("asc"); }
  };

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "participants", label: "Participants", icon: Users },
    { key: "analytics", label: "Analytics", icon: TrendingUp },
    { key: "settings", label: "Configuration", icon: Settings },
  ];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const sortedUsers = getSortedUsers();
  const top3 = users.filter(u => u.predicted_rank < 99999).sort((a, b) => a.predicted_rank - b.predicted_rank).slice(0, 3);

  // Analytics data
  const streakDistribution = [
    { label: "0 days", count: users.filter(u => u.streak === 0).length },
    { label: "1-3 days", count: users.filter(u => u.streak >= 1 && u.streak <= 3).length },
    { label: "4-7 days", count: users.filter(u => u.streak >= 4 && u.streak <= 7).length },
    { label: "8-14 days", count: users.filter(u => u.streak >= 8 && u.streak <= 14).length },
    { label: "15-30 days", count: users.filter(u => u.streak >= 15 && u.streak <= 30).length },
    { label: "30+ days", count: users.filter(u => u.streak > 30).length },
  ];
  const maxStreakDist = Math.max(...streakDistribution.map(s => s.count), 1);

  const hoursDistribution = [
    { label: "0h", count: users.filter(u => u.total_study_hours === 0).length },
    { label: "1-10h", count: users.filter(u => u.total_study_hours >= 1 && u.total_study_hours <= 10).length },
    { label: "11-50h", count: users.filter(u => u.total_study_hours >= 11 && u.total_study_hours <= 50).length },
    { label: "51-100h", count: users.filter(u => u.total_study_hours >= 51 && u.total_study_hours <= 100).length },
    { label: "100h+", count: users.filter(u => u.total_study_hours > 100).length },
  ];
  const maxHoursDist = Math.max(...hoursDistribution.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          <h2 className="text-xl font-bold text-foreground">Leaderboard Management</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportLeaderboard} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/50">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ─── Overview ─── */}
        {tab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Participants", value: stats.totalParticipants, icon: Users, color: "text-primary" },
                { label: "Opted In", value: stats.optedIn, icon: Eye, color: "text-success" },
                { label: "Opted Out", value: stats.optedOut, icon: EyeOff, color: "text-muted-foreground" },
                { label: "Avg Percentile", value: `${stats.avgPercentile}%`, icon: Percent, color: "text-accent" },
                { label: "Avg Streak", value: `${stats.avgStreak}d`, icon: Flame, color: "text-warning" },
                { label: "Top Streak", value: `${stats.topStreak}d`, icon: Zap, color: "text-warning" },
                { label: "Avg Study Hours", value: `${stats.avgStudyHours}h`, icon: Clock, color: "text-primary" },
                { label: "Top Study Hours", value: `${stats.topStudyHours}h`, icon: Target, color: "text-success" },
              ].map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass rounded-xl p-3.5 neural-border">
                  <div className="flex items-center gap-1.5 mb-1">
                    <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
                    <span className="text-[10px] text-muted-foreground">{c.label}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{c.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Top 3 Podium */}
            {top3.length > 0 && (
              <div className="glass rounded-xl p-5 neural-border">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="w-4 h-4 text-warning" />
                  <h3 className="text-sm font-semibold text-foreground">Top 3 Leaders</h3>
                </div>
                <div className="flex items-end justify-center gap-4">
                  {[1, 0, 2].map(idx => {
                    const u = top3[idx];
                    if (!u) return null;
                    const heights = ["h-28", "h-36", "h-24"];
                    const icons = [Medal, Crown, Award];
                    const colors = ["text-muted-foreground", "text-warning", "text-orange-400"];
                    const Icon = icons[idx];
                    return (
                      <motion.div
                        key={u.user_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.15 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 overflow-hidden ${
                          idx === 1 ? "ring-warning/40 bg-warning/10" : "ring-border bg-secondary"
                        }`}>
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-foreground">{(u.display_name || "?").slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <Icon className={`w-5 h-5 ${colors[idx]}`} />
                        <p className="text-xs font-medium text-foreground truncate max-w-[80px]">{u.display_name || "Anonymous"}</p>
                        <div className={`w-16 ${heights[idx]} rounded-t-lg bg-gradient-to-t ${
                          idx === 1 ? "from-warning/20 to-warning/5" : idx === 0 ? "from-muted/30 to-muted/10" : "from-orange-500/20 to-orange-500/5"
                        } flex flex-col items-center justify-end pb-2`}>
                          <p className="text-[10px] text-muted-foreground">{u.streak}d 🔥</p>
                          <p className="text-[10px] text-muted-foreground">{u.total_study_hours}h</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Visibility Pie */}
            <div className="glass rounded-xl p-5 neural-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Participation Breakdown</h3>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="3"
                      strokeDasharray={`${users.length > 0 ? (stats.optedIn / users.length) * 100 : 0} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-foreground">{users.length > 0 ? Math.round((stats.optedIn / users.length) * 100) : 0}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-xs text-foreground">{stats.optedIn} Visible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-secondary" />
                    <span className="text-xs text-muted-foreground">{stats.optedOut} Hidden</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive/50" />
                    <span className="text-xs text-muted-foreground">{users.filter(u => u.is_banned).length} Banned</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Participants ─── */}
        {tab === "participants" && (
          <motion.div key="participants" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or ID..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
                {(["all", "visible", "hidden"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterVisibility(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      filterVisibility === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "All" : f === "visible" ? "Visible" : "Hidden"}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="glass rounded-xl neural-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("rank")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Rank <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("percentile")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Percentile <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("streak")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Streak <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => handleSort("hours")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                        Hours <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No participants found</TableCell>
                    </TableRow>
                  ) : (
                    sortedUsers.slice(0, 100).map((u, i) => (
                      <TableRow key={u.user_id} className={u.is_banned ? "opacity-50" : ""}>
                        <TableCell className="text-xs font-bold text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground overflow-hidden ring-1 ring-border">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (u.display_name || "?").slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-foreground">{u.display_name || "Anonymous"}</p>
                              <p className="text-[9px] text-muted-foreground font-mono">{u.user_id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-bold ${u.predicted_rank < 100 ? "text-success" : u.predicted_rank < 99999 ? "text-foreground" : "text-muted-foreground"}`}>
                            {u.predicted_rank < 99999 ? `#${u.predicted_rank}` : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{u.percentile > 0 ? `${u.percentile}%` : "—"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-xs">
                            <Flame className="w-3 h-3 text-warning" />
                            <span className="text-foreground font-medium">{u.streak}d</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />{u.total_study_hours}h
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={u.opt_in_leaderboard}
                            onCheckedChange={() => toggleUserVisibility(u.user_id, u.opt_in_leaderboard)}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => resetUserRank(u.user_id)}
                            className="text-[10px] px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          >
                            Reset Rank
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-[10px] text-muted-foreground text-right">Showing {Math.min(sortedUsers.length, 100)} of {sortedUsers.length} users</p>
          </motion.div>
        )}

        {/* ─── Analytics ─── */}
        {tab === "analytics" && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Streak Distribution */}
            <div className="glass rounded-xl p-5 neural-border">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">Streak Distribution</h3>
              </div>
              <div className="space-y-2.5">
                {streakDistribution.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground w-16 text-right">{s.label}</span>
                    <div className="flex-1 h-6 bg-secondary/30 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.count / maxStreakDist) * 100}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-warning/60 to-warning/30 rounded-lg flex items-center justify-end pr-2"
                      >
                        {s.count > 0 && <span className="text-[9px] font-bold text-foreground">{s.count}</span>}
                      </motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Study Hours Distribution */}
            <div className="glass rounded-xl p-5 neural-border">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Study Hours Distribution (90d)</h3>
              </div>
              <div className="space-y-2.5">
                {hoursDistribution.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground w-16 text-right">{s.label}</span>
                    <div className="flex-1 h-6 bg-secondary/30 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.count / maxHoursDist) * 100}%` }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-primary/60 to-primary/30 rounded-lg flex items-center justify-end pr-2"
                      >
                        {s.count > 0 && <span className="text-[9px] font-bold text-foreground">{s.count}</span>}
                      </motion.div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Percentile Spread */}
            <div className="glass rounded-xl p-5 neural-border">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-success" />
                <h3 className="text-sm font-semibold text-foreground">Rank Percentile Spread</h3>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: "Top 10%", range: [90, 100], color: "bg-success/20 text-success" },
                  { label: "Top 25%", range: [75, 89], color: "bg-primary/20 text-primary" },
                  { label: "Top 50%", range: [50, 74], color: "bg-accent/20 text-accent" },
                  { label: "Top 75%", range: [25, 49], color: "bg-warning/20 text-warning" },
                  { label: "Bottom", range: [0, 24], color: "bg-destructive/20 text-destructive" },
                ].map((tier, i) => {
                  const count = users.filter(u => u.percentile >= tier.range[0] && u.percentile <= tier.range[1]).length;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }} className={`rounded-xl p-3 text-center ${tier.color}`}>
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[9px]">{tier.label}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Settings ─── */}
        {tab === "settings" && (
          <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="glass rounded-xl p-5 neural-border space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Leaderboard Configuration</h3>
              </div>

              {/* Max size */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Max Leaderboard Size</p>
                  <p className="text-[10px] text-muted-foreground">Maximum users shown publicly</p>
                </div>
                <select
                  value={maxLeaderboardSize}
                  onChange={e => setMaxLeaderboardSize(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground"
                >
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Options</h4>

                {[
                  { label: "Anonymize Display Names", desc: "Show only first 2 characters + ***", value: anonymizeNames, set: setAnonymizeNames },
                  { label: "Show Streak Count", desc: "Display user streaks on leaderboard", value: showStreaks, set: setShowStreaks },
                  { label: "Show Study Hours", desc: "Display total study hours", value: showStudyHours, set: setShowStudyHours },
                  { label: "Show Percentile", desc: "Display rank percentile", value: showPercentile, set: setShowPercentile },
                  { label: "Allow Freeze Gifting", desc: "Users can gift streak freezes from leaderboard", value: allowFreezeGifts, set: setAllowFreezeGifts },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={item.value} onCheckedChange={item.set} />
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bulk Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      await supabase.from("profiles").update({ opt_in_leaderboard: true }).neq("is_banned", true);
                      toast({ title: "All non-banned users opted in" });
                      load();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
                  >
                    <Eye className="w-3 h-3 inline mr-1" /> Opt-in All
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.from("profiles").update({ opt_in_leaderboard: false });
                      toast({ title: "All users opted out" });
                      load();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <EyeOff className="w-3 h-3 inline mr-1" /> Opt-out All
                  </button>
                  <button
                    onClick={async () => {
                      await supabase.from("rank_predictions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                      toast({ title: "All rank predictions cleared" });
                      load();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-warning/10 text-warning hover:bg-warning/20 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 inline mr-1" /> Reset All Ranks
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeaderboardManagement;
