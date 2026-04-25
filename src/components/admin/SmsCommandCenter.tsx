import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare, Send, Clock, BarChart3, Zap, Eye, Pencil,
  RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, ArrowUpRight, Play, Trash2, Plus, Search,
  FileText, Filter, LayoutDashboard, TestTube, Settings,
  Gauge, Activity, Target, Users, Phone, Shield, Key,
  Sparkles, Copy, Power, ChevronRight, Smartphone, Hash
} from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import SmsEventRegistry from "./SmsEventRegistry";

// ─── Types ───
type SmsLog = {
  id: string;
  mobile: string;
  otp: string;
  channel: "sms" | "whatsapp";
  status: "sent" | "delivered" | "failed" | "verified" | "expired";
  created_at: string;
  verified: boolean;
  expires_at: string;
};

type DailyStats = {
  date: string;
  total: number;
  sms: number;
  whatsapp: number;
  verified: number;
  failed: number;
};

// ─── SMS Dashboard Tab ───
const SmsDashboard = () => {
  const [stats, setStats] = useState({
    totalSent: 0, smsSent: 0, whatsappSent: 0,
    verified: 0, failed: 0, deliveryRate: 0,
    todaySent: 0, todayVerified: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch WhatsApp OTPs from whatsapp_otps table
      const { data: waOtps, count: waTotal } = await supabase
        .from("whatsapp_otps")
        .select("*", { count: "exact" });

      const waVerified = waOtps?.filter(o => o.verified) || [];
      const waToday = waOtps?.filter(o => o.created_at?.startsWith(today)) || [];
      const waTodayVerified = waToday.filter(o => o.verified);

      // We estimate SMS stats from the total minus WhatsApp
      const totalWa = waTotal || 0;
      const totalVerifiedWa = waVerified.length;

      setStats({
        totalSent: totalWa,
        smsSent: 0, // SMS doesn't have a log table yet
        whatsappSent: totalWa,
        verified: totalVerifiedWa,
        failed: 0,
        deliveryRate: totalWa > 0 ? Math.round((totalVerifiedWa / totalWa) * 100) : 0,
        todaySent: waToday.length,
        todayVerified: waTodayVerified.length,
      });

      setRecentLogs(
        (waOtps || []).slice(0, 10).map(o => ({
          id: o.id,
          mobile: o.mobile,
          channel: "whatsapp" as const,
          status: o.verified ? "verified" : isAfter(new Date(), new Date(o.expires_at)) ? "expired" : "sent",
          created_at: o.created_at,
          verified: o.verified,
        }))
      );
    } catch (err) {
      console.error("SMS Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const statCards = [
    { label: "Total OTPs Sent", value: stats.totalSent, icon: Send, color: "text-primary", bg: "bg-primary/10" },
    { label: "WhatsApp OTPs", value: stats.whatsappSent, icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Verified", value: stats.verified, icon: CheckCircle2, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Delivery Rate", value: `${stats.deliveryRate}%`, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Today Sent", value: stats.todaySent, icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Today Verified", value: stats.todayVerified, icon: Shield, color: "text-violet-400", bg: "bg-violet-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">SMS & OTP Dashboard</h3>
          <p className="text-sm text-muted-foreground">Real-time overview of OTP delivery and verification</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s, i) => (
          <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent OTP Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : recentLogs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No OTP activity yet</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      log.channel === "whatsapp" ? "bg-emerald-500/15" : "bg-blue-500/15"
                    }`}>
                      {log.channel === "whatsapp" ? (
                        <MessageSquare className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Smartphone className="h-4 w-4 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-mono text-foreground">+{log.mobile}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), "MMM dd, HH:mm:ss")}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    log.status === "verified" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                    log.status === "expired" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                    "bg-primary/15 text-primary border-primary/30"
                  }>
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── MSG91 Config Tab ───
const Msg91Config = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    authKey: "",
    templateId: "",
    whatsappNumber: "919211788450",
    otpLength: "4",
    otpExpiry: "5",
    templateName: "acry_login_otp",
  });
  const [saving, setSaving] = useState(false);
  const [showAuthKey, setShowAuthKey] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">MSG91 Configuration</h3>
        <p className="text-sm text-muted-foreground">Manage your MSG91 API keys and template settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Auth Key Card */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm">Auth Key</CardTitle>
            </div>
            <CardDescription className="text-xs">MSG91 authentication key (stored as secret)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type={showAuthKey ? "text" : "password"}
                value="••••••••••••••••••••"
                readOnly
                className="font-mono text-sm bg-muted/30"
              />
              <Button variant="outline" size="icon" onClick={() => setShowAuthKey(!showAuthKey)}>
                <Eye className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-400" />
              Stored securely as MSG91_AUTH_KEY
            </p>
          </CardContent>
        </Card>

        {/* Template ID Card */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm">Template ID</CardTitle>
            </div>
            <CardDescription className="text-xs">SMS OTP template ID from MSG91 dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="password"
                value="••••••••••••••••••••"
                readOnly
                className="font-mono text-sm bg-muted/30"
              />
              <Button variant="outline" size="icon">
                <Eye className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-400" />
              Stored securely as MSG91_TEMPLATE_ID
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              <CardTitle className="text-sm">WhatsApp Config</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Integrated Number</label>
              <Input value={config.whatsappNumber} readOnly className="font-mono text-sm bg-muted/30 mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Template Name</label>
              <Input value={config.templateName} readOnly className="font-mono text-sm bg-muted/30 mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* OTP Settings */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-violet-400" />
              <CardTitle className="text-sm">OTP Settings</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">OTP Length</label>
                <Input value={config.otpLength} readOnly className="font-mono text-sm bg-muted/30 mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Expiry (min)</label>
                <Input value={config.otpExpiry} readOnly className="font-mono text-sm bg-muted/30 mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/30">
              <span className="text-xs text-muted-foreground">Channel Isolation</span>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/20 border border-border/30">
              <span className="text-xs text-muted-foreground">Real-time Response</span>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Enabled</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edge Function Info */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-sm">Edge Function: msg91-otp</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["send", "send_whatsapp", "verify", "resend", "resend_whatsapp"].map(action => (
              <div key={action} className="p-3 rounded-lg bg-muted/20 border border-border/30 text-center">
                <p className="text-xs font-mono text-primary">{action}</p>
                <Badge variant="outline" className="mt-2 text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── SMS Logs Tab ───
const SmsLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "pending" | "expired">("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("whatsapp_otps")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      setLogs((data || []).map(o => ({
        ...o,
        channel: "whatsapp",
        status: o.verified ? "verified" : isAfter(new Date(), new Date(o.expires_at)) ? "expired" : "pending",
      })));
    } catch (err) {
      console.error("Fetch SMS logs error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l => {
    if (search && !l.mobile.includes(search)) return false;
    if (filter !== "all" && l.status !== filter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">OTP Logs & History</h3>
          <p className="text-sm text-muted-foreground">Complete log of all OTP requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by mobile number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "verified", "pending", "expired"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize text-xs"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">No logs found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>OTP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Expires At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">+{log.mobile}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          log.channel === "whatsapp"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }>
                          {log.channel === "whatsapp" ? "WhatsApp" : "SMS"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{log.otp ? `••${log.otp.slice(-2)}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          log.status === "verified" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                          log.status === "expired" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                          "bg-primary/15 text-primary border-primary/30"
                        }>
                          {log.status === "verified" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {log.status === "expired" && <Clock className="h-3 w-3 mr-1" />}
                          {log.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.expires_at), "MMM dd, HH:mm:ss")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Template Management Tab ───
const SmsTemplates = () => {
  const templates = [
    {
      id: "sms-otp",
      name: "SMS OTP Template",
      channel: "SMS",
      provider: "MSG91",
      templateId: "MSG91_TEMPLATE_ID",
      variables: ["##OTP##"],
      status: "active",
      description: "4-digit OTP sent via MSG91 SMS API with 5-minute expiry",
    },
    {
      id: "wa-otp",
      name: "acry_login_otp",
      channel: "WhatsApp",
      provider: "MSG91 WhatsApp",
      templateId: "acry_login_otp",
      namespace: "34be867f_2430_42e1_bcd8_1831c618f724",
      variables: ["body_1 (OTP)", "button_1 (OTP)"],
      status: "active",
      description: "WhatsApp template message with OTP in body and copy-button",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">SMS & WhatsApp Templates</h3>
        <p className="text-sm text-muted-foreground">Manage OTP message templates across channels</p>
      </div>

      <div className="grid gap-4">
        {templates.map(t => (
          <Card key={t.id} className="border-border/50 bg-card/50">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    t.channel === "WhatsApp" ? "bg-emerald-500/15" : "bg-blue-500/15"
                  }`}>
                    {t.channel === "WhatsApp" ? (
                      <MessageSquare className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <Smartphone className="h-6 w-6 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">{t.name}</h4>
                      <Badge variant="outline" className={
                        t.channel === "WhatsApp"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                      }>{t.channel}</Badge>
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">{t.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs text-muted-foreground">Provider:</span>
                      <Badge variant="secondary" className="text-xs">{t.provider}</Badge>
                      <span className="text-xs text-muted-foreground ml-2">Template:</span>
                      <Badge variant="secondary" className="text-xs font-mono">{t.templateId}</Badge>
                    </div>
                    {(t as any).namespace && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Namespace:</span>
                        <code className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">{(t as any).namespace}</code>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-3">
                      <span className="text-xs text-muted-foreground mr-1">Variables:</span>
                      {t.variables.map(v => (
                        <Badge key={v} variant="outline" className="text-xs font-mono bg-muted/30">{v}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── Test SMS Tab ───
const SmsTestSender = () => {
  const { toast } = useToast();
  const [mobile, setMobile] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sendTestOtp = async () => {
    if (!mobile || mobile.length < 10) {
      toast({ title: "Invalid number", description: "Enter a valid mobile number with country code", variant: "destructive" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const action = channel === "whatsapp" ? "send_whatsapp" : "send";
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action, mobile: mobile.replace(/\s+/g, "") },
      });
      if (error) throw error;
      setResult(data);
      setOtpSent(true);
      toast({ title: "OTP Sent!", description: `Test OTP sent via ${channel.toUpperCase()}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message || "Failed to send OTP", variant: "destructive" });
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

  const verifyTestOtp = async () => {
    if (!otp || otp.length !== 4) {
      toast({ title: "Invalid OTP", description: "Enter the 4-digit OTP", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("msg91-otp", {
        body: { action: "verify", mobile: mobile.replace(/\s+/g, ""), otp },
      });
      if (error) throw error;
      setResult(data);
      toast({
        title: data?.verified ? "Verified!" : "Failed",
        description: data?.verified ? "OTP verified successfully" : "OTP verification failed",
        variant: data?.verified ? "default" : "destructive",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setResult({ error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-foreground">Test OTP Sender</h3>
        <p className="text-sm text-muted-foreground">Send test OTPs to verify SMS/WhatsApp delivery</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TestTube className="h-4 w-4 text-primary" />
              Send Test OTP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mobile Number (with country code)</label>
              <Input
                placeholder="919876543210"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Channel</label>
              <div className="flex gap-2">
                <Button
                  variant={channel === "sms" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel("sms")}
                  className="flex-1"
                >
                  <Smartphone className="h-4 w-4 mr-2" /> SMS
                </Button>
                <Button
                  variant={channel === "whatsapp" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel("whatsapp")}
                  className="flex-1"
                >
                  <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
                </Button>
              </div>
            </div>
            <Button onClick={sendTestOtp} disabled={sending} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Test OTP
            </Button>

            {otpSent && (
              <div className="pt-4 border-t border-border/30 space-y-3">
                <label className="text-xs text-muted-foreground block">Enter OTP to verify</label>
                <Input
                  placeholder="1234"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={4}
                  className="font-mono text-center text-lg tracking-[0.5em]"
                />
                <Button onClick={verifyTestOtp} disabled={verifying} variant="outline" className="w-full">
                  {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Verify OTP
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Response Panel */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${
                  result.success || result.verified
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-destructive/10 border-destructive/30"
                }`}>
                  <div className="flex items-center gap-2">
                    {result.success || result.verified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {result.success || result.verified ? "Success" : "Failed"}
                    </span>
                  </div>
                </div>
                <ScrollArea className="h-[300px]">
                  <pre className="text-xs font-mono text-muted-foreground bg-muted/30 p-4 rounded-lg whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Send an OTP to see the response</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// ─── Generated OTPs Tab ───
const GeneratedOtps = () => {
  const [otps, setOtps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "verified" | "expired">("all");

  const fetchOtps = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_otps")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && data) setOtps(data);
    } catch (e) {
      console.error("Failed to fetch OTPs", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOtps(); }, [fetchOtps]);

  const now = new Date();
  const filtered = otps.filter(o => {
    if (searchQuery && !o.mobile.includes(searchQuery)) return false;
    if (filterStatus === "verified" && !o.verified) return false;
    if (filterStatus === "active" && (o.verified || new Date(o.expires_at) < now)) return false;
    if (filterStatus === "expired" && (o.verified || new Date(o.expires_at) >= now)) return false;
    return true;
  });

  const totalActive = otps.filter(o => !o.verified && new Date(o.expires_at) >= now).length;
  const totalVerified = otps.filter(o => o.verified).length;
  const totalExpired = otps.filter(o => !o.verified && new Date(o.expires_at) < now).length;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-cyan-400" /> Generated SMS OTPs
            </CardTitle>
            <CardDescription className="text-xs mt-1">View all OTPs generated by the system</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchOtps} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active", value: totalActive, color: "text-success", bg: "bg-success/10" },
            { label: "Verified", value: totalVerified, color: "text-primary", bg: "bg-primary/10" },
            { label: "Expired", value: totalExpired, color: "text-muted-foreground", bg: "bg-muted/30" },
          ].map(s => (
            <div key={s.label} className={`rounded-lg p-3 ${s.bg} text-center`}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by mobile..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs bg-secondary/30"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "active", "verified", "expired"] as const).map(f => (
              <Button
                key={f}
                variant={filterStatus === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(f)}
                className="text-[10px] h-9 px-2.5 capitalize"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No OTPs found</p>
        ) : (
          <ScrollArea className="h-[420px]">
             <Table>
              <TableHeader>
                <TableRow className="text-[10px]">
                  <TableHead className="text-[10px]">Mobile</TableHead>
                  <TableHead className="text-[10px]">OTP</TableHead>
                  <TableHead className="text-[10px]">Channel</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Created</TableHead>
                  <TableHead className="text-[10px]">Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(o => {
                  const expired = !o.verified && new Date(o.expires_at) < now;
                  const status = o.verified ? "verified" : expired ? "expired" : "active";
                  return (
                    <TableRow key={o.id} className="text-xs">
                      <TableCell className="font-mono text-foreground">{o.mobile}</TableCell>
                      <TableCell>
                        <span className="font-mono font-bold text-sm tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {o.otp}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          o.channel === "sms"
                            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                            : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        }>
                          {o.channel === "sms" ? "SMS" : "WhatsApp"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          status === "verified"
                            ? "bg-success/15 text-success border-success/30"
                            : status === "active"
                            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                            : "bg-muted/30 text-muted-foreground border-border/50"
                        }>
                          {status === "verified" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {status === "active" && <Zap className="h-3 w-3 mr-1" />}
                          {status === "expired" && <Clock className="h-3 w-3 mr-1" />}
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[10px]">
                        {format(new Date(o.created_at), "dd MMM, hh:mm a")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[10px]">
                        {format(new Date(o.expires_at), "dd MMM, hh:mm a")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Main Component ───
const SmsCommandCenter = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <Smartphone className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">SMS Command Center</h2>
          <p className="text-sm text-muted-foreground">Manage SMS & WhatsApp OTP delivery via MSG91</p>
        </div>
      </div>

      <Tabs defaultValue="generated_otps" className="space-y-4">
        <TabsList className="bg-muted/30 border border-border/50 p-1 flex-wrap h-auto">
          <TabsTrigger value="generated_otps" className="gap-2 data-[state=active]:bg-cyan-500/15">
            <Hash className="h-4 w-4" /> Generated OTPs
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-primary/15">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-amber-500/15">
            <Settings className="h-4 w-4" /> MSG91 Config
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2 data-[state=active]:bg-emerald-500/15">
            <FileText className="h-4 w-4" /> Logs & History
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-violet-500/15">
            <Copy className="h-4 w-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2 data-[state=active]:bg-fuchsia-500/15">
            <Zap className="h-4 w-4" /> Auto Events
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2 data-[state=active]:bg-blue-500/15">
            <TestTube className="h-4 w-4" /> Test SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generated_otps"><GeneratedOtps /></TabsContent>
        <TabsContent value="dashboard"><SmsDashboard /></TabsContent>
        <TabsContent value="config"><Msg91Config /></TabsContent>
        <TabsContent value="logs"><SmsLogs /></TabsContent>
        <TabsContent value="templates"><SmsTemplates /></TabsContent>
        <TabsContent value="events"><SmsEventRegistry /></TabsContent>
        <TabsContent value="test"><SmsTestSender /></TabsContent>
      </Tabs>
    </div>
  );
};

export default SmsCommandCenter;
