import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Rocket, Users, TrendingUp, Target, BarChart3, Zap, Flame,
  RefreshCw, Loader2, Calendar, Award, ArrowUpRight, Clock,
  UserPlus, Sparkles, ShieldAlert, Crown, Eye, Megaphone
} from "lucide-react";

const SEGMENT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  new_user: { label: "New Users", color: "bg-blue-500", icon: UserPlus },
  early_learner: { label: "Early Learners", color: "bg-cyan-500", icon: Eye },
  active_learner: { label: "Active Learners", color: "bg-emerald-500", icon: TrendingUp },
  power_user: { label: "Power Users", color: "bg-purple-500", icon: Crown },
  at_risk: { label: "At-Risk", color: "bg-amber-500", icon: ShieldAlert },
  dormant: { label: "Dormant", color: "bg-gray-500", icon: Clock },
  exam_week: { label: "Exam Week", color: "bg-red-500", icon: Calendar },
  premium: { label: "Premium", color: "bg-yellow-500", icon: Award },
  high_churn_risk: { label: "High Churn Risk", color: "bg-destructive", icon: ShieldAlert },
};

const GrowthControlCenter = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState("segments");
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsDays, setAnalyticsDays] = useState("30");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        supabase.functions.invoke("growth-engine", { body: { action: "get_growth_dashboard" } }),
        supabase.functions.invoke("growth-engine", { body: { action: "get_growth_analytics", data: { days: parseInt(analyticsDays) } } }),
      ]);
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [analyticsDays, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runGrowthEngine = async () => {
    toast({ title: "Running Growth Engine..." });
    try {
      const res = await supabase.functions.invoke("growth-engine", { body: { action: "run_daily_growth" } });
      toast({ title: "Growth Engine Complete", description: `Processed ${res.data?.processed || 0} users, ${res.data?.journeys_fired || 0} journeys fired` });
      fetchAll();
    } catch {
      toast({ title: "Error running engine", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const d = dashboard || {};
  const a = analytics || {};
  const segDist = d.segment_distribution || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Rocket className="w-7 h-7 text-primary" /> Growth Control Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Automated user segmentation, activation journeys, and growth triggers</p>
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
          <Button size="sm" variant="outline" onClick={runGrowthEngine}><Zap className="w-4 h-4 mr-1" /> Run Now</Button>
          <Button size="sm" variant="outline" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Segmented", value: d.total_segments || 0, icon: Users, color: "text-primary" },
          { label: "Active Journeys", value: d.active_journeys || 0, icon: Flame, color: "text-amber-400" },
          { label: "Completed Journeys", value: d.completed_journeys || 0, icon: Award, color: "text-emerald-400" },
          { label: "Growth Triggers", value: a.total_triggers || 0, icon: Target, color: "text-purple-400" },
          { label: "Delivery Rate", value: `${a.delivery_rate || 0}%`, icon: TrendingUp, color: "text-blue-400" },
        ].map(s => (
          <Card key={s.label} className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="segments" className="text-xs gap-1"><Users className="w-3.5 h-3.5" /> Segments</TabsTrigger>
          <TabsTrigger value="journeys" className="text-xs gap-1"><Flame className="w-3.5 h-3.5" /> Journeys</TabsTrigger>
          <TabsTrigger value="triggers" className="text-xs gap-1"><Target className="w-3.5 h-3.5" /> Triggers</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" /> Analytics</TabsTrigger>
        </TabsList>

        {/* ═══ SEGMENTS ═══ */}
        <TabsContent value="segments" className="space-y-4 mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> User Segment Distribution</CardTitle>
              <CardDescription className="text-xs">AI dynamically assigns users to segments based on activity, age, churn risk, and subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(segDist).sort(([,a]: any, [,b]: any) => b - a).map(([key, count]: any) => {
                const cfg = SEGMENT_CONFIG[key] || { label: key, color: "bg-primary", icon: Users };
                const Icon = cfg.icon;
                const total = d.total_segments || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{cfg.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{count} users ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(segDist).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No segments computed yet. Click "Run Now" to process users.</p>
              )}
            </CardContent>
          </Card>

          {/* Segment Notification Rules */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Segment Notification Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Segment</TableHead>
                      <TableHead className="text-xs">Frequency</TableHead>
                      <TableHead className="text-xs">Tone</TableHead>
                      <TableHead className="text-xs">Priority Channels</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { seg: "new_user", freq: "High (3-4/day)", tone: "Welcoming", channels: "Push, WhatsApp" },
                      { seg: "early_learner", freq: "Medium (2/day)", tone: "Encouraging", channels: "Push, Email" },
                      { seg: "active_learner", freq: "Normal (1-2/day)", tone: "Informative", channels: "Push" },
                      { seg: "power_user", freq: "Low (1/day)", tone: "Competitive", channels: "Push, In-App" },
                      { seg: "at_risk", freq: "High (3/day)", tone: "Urgent", channels: "Push, WhatsApp, Email" },
                      { seg: "dormant", freq: "Critical (4/day)", tone: "Loss Aversion", channels: "WhatsApp, Voice, Email" },
                      { seg: "exam_week", freq: "Very High", tone: "Serious Mentor", channels: "All Channels" },
                      { seg: "high_churn_risk", freq: "Escalation", tone: "Emotional", channels: "Escalation Ladder" },
                    ].map(r => {
                      const cfg = SEGMENT_CONFIG[r.seg] || { label: r.seg, color: "bg-primary", icon: Users };
                      return (
                        <TableRow key={r.seg}>
                          <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{cfg.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.freq}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.tone}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.channels}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ JOURNEYS ═══ */}
        <TabsContent value="journeys" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Journeys</p>
                  <p className="text-2xl font-bold text-foreground">{d.active_journeys || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Award className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-foreground">{d.completed_journeys || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{a.journey_completion_rate || 0}% completion rate</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> 30-Day Activation Journey</CardTitle>
              <CardDescription className="text-xs">Automated onboarding sequence for new users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { day: 0, label: "Welcome + Setup Reminder", icon: "🎉" },
                  { day: 1, label: "First Study Trigger", icon: "⚡" },
                  { day: 3, label: "First Improvement Alert", icon: "📈" },
                  { day: 7, label: "Streak Reinforcement", icon: "🔥" },
                  { day: 14, label: "AI Performance Insight", icon: "🤖" },
                  { day: 21, label: "Competitive Ranking Trigger", icon: "🏆" },
                  { day: 30, label: "Subscription Reinforcement", icon: "✨" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm shrink-0">
                      {step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Day {step.day}</p>
                      <p className="text-[10px] text-muted-foreground">{step.label}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] text-primary border-primary/30 shrink-0">Auto</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TRIGGERS ═══ */}
        <TabsContent value="triggers" className="space-y-4 mt-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Growth Trigger Distribution</CardTitle>
              <CardDescription className="text-xs">Breakdown of automated triggers fired in the last {a.period_days || 30} days</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(a.trigger_breakdown || {}).sort(([,a]: any, [,b]: any) => b - a).map(([key, count]: any) => {
                const total = a.total_triggers || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {Object.keys(a.trigger_breakdown || {}).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No triggers fired yet in this period</p>
              )}
            </CardContent>
          </Card>

          {/* Trigger Types */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Growth Trigger Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { type: "Journey Steps", desc: "30-day onboarding messages", icon: Flame, color: "text-amber-400" },
                  { type: "Subscription Conversion", desc: "Trial expiry countdowns & feature teasers", icon: Crown, color: "text-yellow-400" },
                  { type: "Referral Prompts", desc: "Milestone-based share triggers", icon: UserPlus, color: "text-blue-400" },
                  { type: "Exam Mode Alerts", desc: "Intensity escalation near exam dates", icon: Calendar, color: "text-red-400" },
                  { type: "Churn Prevention", desc: "AI-predicted risk intervention", icon: ShieldAlert, color: "text-purple-400" },
                  { type: "Habit Loop", desc: "Morning/midday/evening cycle", icon: ArrowUpRight, color: "text-emerald-400" },
                ].map(t => (
                  <div key={t.type} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg">
                    <t.icon className={`w-5 h-5 ${t.color} shrink-0`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{t.type}</p>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ ANALYTICS ═══ */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Triggers", value: a.total_triggers || 0, icon: Target, color: "text-primary" },
              { label: "Journey Completion", value: `${a.journey_completion_rate || 0}%`, icon: Award, color: "text-emerald-400" },
              { label: "Total Deliveries", value: a.total_deliveries || 0, icon: Megaphone, color: "text-blue-400" },
              { label: "Delivery Rate", value: `${a.delivery_rate || 0}%`, icon: TrendingUp, color: "text-purple-400" },
            ].map(s => (
              <Card key={s.label} className="bg-card/50 border-border/50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                    <span className="text-[10px] text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Analytics Rows */}
          {(d.recent_analytics || []).length > 0 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Daily Growth Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Segment</TableHead>
                        <TableHead className="text-xs">DAU</TableHead>
                        <TableHead className="text-xs">Sent</TableHead>
                        <TableHead className="text-xs">Referrals</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.recent_analytics.map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{row.metric_date}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] capitalize">{(row.segment_key || "all").replace(/_/g, " ")}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{row.dau}</TableCell>
                          <TableCell className="text-xs">{row.notifications_sent}</TableCell>
                          <TableCell className="text-xs">{row.referral_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GrowthControlCenter;
