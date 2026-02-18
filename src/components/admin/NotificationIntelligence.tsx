import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain, Zap, TrendingUp, Activity, BarChart3, Shield, Users,
  RefreshCw, Loader2, AlertTriangle, Target, Eye, Volume2,
  Mail, Smartphone, MessageSquare, Clock, Sparkles, Flame,
  ArrowUpRight, ArrowDownRight, Gauge, Puzzle, Siren, BellRing
} from "lucide-react";

const NotificationIntelligence = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsDays, setAnalyticsDays] = useState("30");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        supabase.functions.invoke("intelligent-notify-engine", { body: { action: "get_dashboard" } }),
        supabase.functions.invoke("intelligent-notify-engine", { body: { action: "get_analytics", data: { days: parseInt(analyticsDays) } } }),
      ]);
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [analyticsDays, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const d = dashboard || {};
  const a = analytics || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" /> Notification Intelligence Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">AI-powered behavioral growth engine — personal AI mentor system</p>
        </div>
        <div className="flex gap-2">
          <Select value={analyticsDays} onValueChange={setAnalyticsDays}>
            <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="14">14 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs gap-1"><Gauge className="w-3.5 h-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="behavioral" className="text-xs gap-1"><Brain className="w-3.5 h-3.5" /> Behavioral</TabsTrigger>
          <TabsTrigger value="churn" className="text-xs gap-1"><Shield className="w-3.5 h-3.5" /> Churn</TabsTrigger>
          <TabsTrigger value="channels" className="text-xs gap-1"><Zap className="w-3.5 h-3.5" /> Channels</TabsTrigger>
          <TabsTrigger value="escalations" className="text-xs gap-1"><Siren className="w-3.5 h-3.5" /> Escalations</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" /> Analytics</TabsTrigger>
        </TabsList>

        {/* ═══════════ OVERVIEW ═══════════ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Avg Engagement", value: `${d.avg_engagement || 0}%`, icon: TrendingUp, color: "text-emerald-400", sub: `${d.total_profiles || 0} profiles` },
              { label: "Avg Churn Risk", value: `${d.avg_churn_risk || 0}%`, icon: AlertTriangle, color: d.avg_churn_risk > 30 ? "text-destructive" : "text-amber-400", sub: "across all users" },
              { label: "Silence Mode", value: d.silence_mode_count || 0, icon: Volume2, color: "text-blue-400", sub: "users paused" },
              { label: "Notifications Sent", value: a.total_sent || 0, icon: BellRing, color: "text-primary", sub: `${a.delivery_rate || 0}% delivered` },
            ].map(s => (
              <Card key={s.label} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Distributions Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <DistributionCard title="Motivation Types" icon={Target} data={d.motivation_distribution} colorMap={{ achievement: "bg-emerald-500", loss_aversion: "bg-red-500", social_proof: "bg-blue-500", curiosity: "bg-purple-500" }} />
            <DistributionCard title="Dopamine Strategies" icon={Sparkles} data={d.strategy_distribution} colorMap={{ curiosity: "bg-purple-500", scarcity: "bg-amber-500", social_proof: "bg-blue-500", progress: "bg-emerald-500" }} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <DistributionCard title="Stress Levels" icon={Activity} data={d.stress_distribution} colorMap={{ normal: "bg-emerald-500", moderate: "bg-amber-500", high: "bg-red-500" }} />
            <DistributionCard title="Habit Loop Stages" icon={Puzzle} data={d.habit_distribution} colorMap={{ cue: "bg-blue-500", action: "bg-amber-500", reward: "bg-purple-500", reinforcement: "bg-emerald-500" }} />
          </div>

          {/* Active A/B Tests */}
          {d.active_ab_tests?.length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Active A/B Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {d.active_ab_tests.map((test: any) => (
                    <div key={test.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-foreground">{test.event_type}</p>
                        <p className="text-xs text-muted-foreground">A: {test.variant_a_sent} sent • B: {test.variant_b_sent} sent</p>
                      </div>
                      <Badge variant="outline" className="text-primary border-primary/30">
                        {test.winner ? `Winner: ${test.winner}` : "Running"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════ BEHAVIORAL PROFILES ═══════════ */}
        <TabsContent value="behavioral" className="space-y-4 mt-4">
          <BehavioralProfilesTab />
        </TabsContent>

        {/* ═══════════ CHURN PREVENTION ═══════════ */}
        <TabsContent value="churn" className="space-y-4 mt-4">
          <ChurnTab data={d} analytics={a} />
        </TabsContent>

        {/* ═══════════ CHANNELS ═══════════ */}
        <TabsContent value="channels" className="space-y-4 mt-4">
          <ChannelsTab analytics={a} />
        </TabsContent>

        {/* ═══════════ ESCALATIONS ═══════════ */}
        <TabsContent value="escalations" className="space-y-4 mt-4">
          <EscalationsTab data={d} />
        </TabsContent>

        {/* ═══════════ ANALYTICS ═══════════ */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <AnalyticsTab analytics={a} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Sub-Components ───

const DistributionCard = ({ title, icon: Icon, data, colorMap }: { title: string; icon: any; data: any; colorMap: Record<string, string> }) => {
  if (!data || Object.keys(data).length === 0) return null;
  const total = Object.values(data).reduce((s: number, v: any) => s + v, 0) as number;
  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Icon className="w-4 h-4 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(data).sort(([,a]: any, [,b]: any) => b - a).map(([key, val]: any) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-foreground capitalize">{key.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">{val} ({total > 0 ? Math.round((val / total) * 100) : 0}%)</span>
            </div>
            <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${colorMap[key] || "bg-primary"}`} style={{ width: `${total > 0 ? (val / total) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const BehavioralProfilesTab = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("behavioral_profiles").select("*, profiles:user_id(display_name, email)").order("engagement_score", { ascending: false }).limit(50);
      setProfiles(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> User Behavioral Profiles</CardTitle>
        <CardDescription className="text-xs">AI-computed behavioral intelligence for each user</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Engagement</TableHead>
                <TableHead className="text-xs">Churn Risk</TableHead>
                <TableHead className="text-xs">Motivation</TableHead>
                <TableHead className="text-xs">Strategy</TableHead>
                <TableHead className="text-xs">Habit Stage</TableHead>
                <TableHead className="text-xs">Best Hour</TableHead>
                <TableHead className="text-xs">Stress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-medium">{p.profiles?.display_name || p.user_id?.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={p.engagement_score || 0} className="h-2 w-16" />
                      <span className="text-xs text-muted-foreground">{p.engagement_score}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${
                      p.churn_risk_score >= 0.7 ? "text-destructive border-destructive/30" :
                      p.churn_risk_score >= 0.4 ? "text-amber-400 border-amber-400/30" :
                      "text-emerald-400 border-emerald-400/30"
                    }`}>
                      {Math.round(p.churn_risk_score * 100)}%
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{p.motivation_type?.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{p.dopamine_strategy?.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell><span className="text-xs capitalize text-muted-foreground">{p.habit_loop_stage}</span></TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{p.best_send_hour}:00</span></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${
                      p.stress_level === "high" ? "text-destructive border-destructive/30" :
                      p.stress_level === "moderate" ? "text-amber-400 border-amber-400/30" :
                      "text-emerald-400 border-emerald-400/30"
                    }`}>{p.stress_level}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {profiles.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">No behavioral profiles computed yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const ChurnTab = ({ data, analytics }: { data: any; analytics: any }) => {
  const churnLevels = data?.churn_by_level || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Critical Risk", value: churnLevels.critical || 0, color: "text-destructive", icon: AlertTriangle },
          { label: "High Risk", value: churnLevels.high || 0, color: "text-amber-400", icon: ArrowUpRight },
          { label: "Medium Risk", value: churnLevels.medium || 0, color: "text-blue-400", icon: Activity },
          { label: "Churns Prevented", value: analytics?.churn_prevented || 0, color: "text-emerald-400", icon: Shield },
        ].map(s => (
          <Card key={s.label} className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Churn Prevention Protocol</CardTitle>
          <CardDescription className="text-xs">AI automatically detects and intervenes before users churn</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { stage: "Detection", desc: "AI analyzes activity decline, session gaps, and engagement patterns", icon: Eye, status: "active" },
              { stage: "Escalation", desc: "Push → WhatsApp → Email → Voice — progressive urgency ladder", icon: Siren, status: "active" },
              { stage: "Recovery", desc: "Dopamine-optimized motivation copy with psychological triggers", icon: Sparkles, status: "active" },
            ].map(s => (
              <div key={s.stage} className="p-4 bg-secondary/30 rounded-xl border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{s.stage}</span>
                  <Badge className="ml-auto text-[9px] bg-emerald-500/15 text-emerald-400">{s.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ChannelsTab = ({ analytics }: { analytics: any }) => {
  const channels = analytics?.channel_effectiveness || [];
  const channelIcons: Record<string, any> = { push: Smartphone, whatsapp: MessageSquare, email: Mail, voice: Volume2 };
  const channelColors: Record<string, string> = { push: "text-blue-400", whatsapp: "text-emerald-400", email: "text-amber-400", voice: "text-purple-400" };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {channels.map((ch: any) => {
          const Icon = channelIcons[ch.channel] || Zap;
          const color = channelColors[ch.channel] || "text-primary";
          const openRate = ch.total_sent > 0 ? Math.round((ch.total_opened / ch.total_sent) * 100) : 0;
          const clickRate = ch.total_sent > 0 ? Math.round((ch.total_clicked / ch.total_sent) * 100) : 0;
          return (
            <Card key={ch.channel} className="bg-card/50 border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-sm font-semibold text-foreground capitalize">{ch.channel}</span>
                  <Badge variant="outline" className="ml-auto text-[9px]">
                    Score: {Math.round((ch.effectiveness_score || 0) * 100)}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-secondary/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{ch.total_sent}</p>
                    <p className="text-[9px] text-muted-foreground">Sent</p>
                  </div>
                  <div className="p-2 bg-secondary/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{openRate}%</p>
                    <p className="text-[9px] text-muted-foreground">Open Rate</p>
                  </div>
                  <div className="p-2 bg-secondary/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{clickRate}%</p>
                    <p className="text-[9px] text-muted-foreground">Click Rate</p>
                  </div>
                  <div className="p-2 bg-secondary/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{ch.total_ignored}</p>
                    <p className="text-[9px] text-muted-foreground">Ignored</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {channels.length === 0 && (
          <Card className="bg-card/50 border-border/50 col-span-full">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No channel data yet — effectiveness learns automatically from user interactions
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Auto-Learning Channel Priority</CardTitle>
          <CardDescription className="text-xs">AI dynamically ranks channels per user based on open/click rates. Low-performing channels are auto-disabled after 50+ sends with {"<"}5% engagement.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            <p className="text-xs text-muted-foreground">The system continuously learns which channel each user responds to best. Channel ranking is recalculated after every notification interaction.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const EscalationsTab = ({ data }: { data: any }) => {
  const escalations = data?.active_escalations || [];
  const LADDER = ["Push", "WhatsApp", "Email", "Voice"];

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Siren className="w-4 h-4 text-destructive" /> Brain Risk Escalation Protocol</CardTitle>
          <CardDescription className="text-xs">When memory risks are ignored, the system auto-escalates through channels: Push → WhatsApp → Email → Voice</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Ladder visualization */}
          <div className="flex items-center gap-2 mb-6 p-4 bg-secondary/20 rounded-xl">
            {LADDER.map((ch, i) => (
              <div key={ch} className="flex items-center gap-2">
                <div className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  i === 0 ? "bg-blue-500/15 text-blue-400" :
                  i === 1 ? "bg-emerald-500/15 text-emerald-400" :
                  i === 2 ? "bg-amber-500/15 text-amber-400" :
                  "bg-red-500/15 text-red-400"
                }`}>{ch}</div>
                {i < LADDER.length - 1 && <ArrowUpRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>

          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Event</TableHead>
                  <TableHead className="text-xs">Level</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {escalations.map((e: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{e.event_type?.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${
                        e.current_escalation_level >= 3 ? "text-destructive border-destructive/30" :
                        e.current_escalation_level >= 2 ? "text-amber-400 border-amber-400/30" :
                        "text-blue-400 border-blue-400/30"
                      }`}>Level {e.current_escalation_level} — {LADDER[e.current_escalation_level] || "Voice"}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{e.resolved ? "Resolved" : "Active"}</Badge></TableCell>
                  </TableRow>
                ))}
                {escalations.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-10">No active escalations — all users responding to notifications</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

const AnalyticsTab = ({ analytics }: { analytics: any }) => {
  const a = analytics || {};
  const channelBreakdown = a.channel_breakdown || {};

  return (
    <div className="space-y-4">
      {/* ROI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sent", value: a.total_sent || 0, icon: BellRing, color: "text-primary" },
          { label: "Delivery Rate", value: `${a.delivery_rate || 0}%`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Churns Prevented", value: a.churn_prevented || 0, icon: Shield, color: "text-blue-400" },
          { label: "Notifications Bundled", value: a.total_bundled || 0, icon: Puzzle, color: "text-purple-400" },
        ].map(s => (
          <Card key={s.label} className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Channel Breakdown */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Channel Distribution ({a.period_days || 30}d)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(channelBreakdown).sort(([,a]: any, [,b]: any) => b - a).map(([ch, count]: any) => {
              const total = a.total_sent || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={ch} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground capitalize">{ch}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(channelBreakdown).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No delivery data for this period</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Escalation Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Siren className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Total Escalated</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{a.total_escalated || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{a.resolved_escalations || 0} resolved</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-destructive" />
              <span className="text-xs text-muted-foreground">High Risk Users</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{a.high_risk_users || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-1">critical + high churn risk</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationIntelligence;
