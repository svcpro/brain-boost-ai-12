import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Users, Clock, CheckCircle2, XCircle, Eye,
  RefreshCw, Loader2, Search, Phone, FileText, Image,
  BarChart3, Zap, AlertTriangle, ChevronDown, Plus, Trash2, Edit3,
  Globe, TrendingUp, Shield, Settings, Copy, Bell, Calendar,
  ArrowUpRight, ArrowDownRight, Pause, Play, Download, Hash,
  Smartphone, Radio, Target, Activity, Wifi, WifiOff, Bot,
  DollarSign, PieChart, Megaphone, UserPlus, Filter, Star,
  GitBranch, Layers, Crown, ArrowRight, ChevronRight,
  Mail, Volume2, Flame, Trophy, BookOpen, Brain, Heart,
  Gauge, Server, CreditCard, Receipt, TrendingDown,
  ToggleLeft, Tag, MapPin, Milestone, CircleDot, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow, subDays, startOfDay, eachDayOfInterval, subHours } from "date-fns";

// ─── Animated Counter ───
const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => (
  <motion.span key={value} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums">
    {value.toLocaleString()}{suffix}
  </motion.span>
);

// ─── Status Badge ───
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; icon: any; pulse?: boolean }> = {
    queued: { bg: "bg-yellow-500/15", text: "text-yellow-500", icon: Clock },
    sent: { bg: "bg-blue-500/15", text: "text-blue-500", icon: Send },
    delivered: { bg: "bg-green-500/15", text: "text-green-500", icon: CheckCircle2 },
    read: { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: Eye, pulse: true },
    failed: { bg: "bg-destructive/15", text: "text-destructive", icon: XCircle },
    undelivered: { bg: "bg-orange-500/15", text: "text-orange-500", icon: AlertTriangle },
  };
  const c = config[status] || config.sent;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.bg} ${c.text}`}>
      <c.icon className={`w-3 h-3 ${c.pulse ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
};

// ─── Mini Card ───
const MiniStatCard = ({ label, value, icon: Icon, color, border, gradient, sub }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className={`relative overflow-hidden rounded-xl border ${border} bg-gradient-to-br ${gradient} p-3`}>
    <Icon className={`w-4 h-4 ${color} mb-2`} />
    <p className="text-xl font-bold text-foreground"><AnimatedNumber value={value} /></p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
    {sub && <span className={`absolute top-2 right-2 text-[10px] font-bold ${color}`}>{sub}</span>}
  </motion.div>
);

// ─── Section Header ───
const SectionHeader = ({ icon: Icon, title, subtitle, color = "text-green-500" }: any) => (
  <div className="flex items-center gap-3 mb-4">
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-600/10 flex items-center justify-center`}>
      <Icon className={`w-4.5 h-4.5 ${color}`} />
    </div>
    <div>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

// ─── Connection Health Panel ───
const ConnectionHealthPanel = () => {
  const [health, setHealth] = useState<{ connected: boolean; lastCheck: Date | null; latency: number | null }>({
    connected: false, lastCheck: null, latency: null,
  });
  const [checking, setChecking] = useState(false);
  const checkHealth = useCallback(async () => {
    setChecking(true);
    const start = Date.now();
    try {
      await supabase.functions.invoke("send-whatsapp", {
        body: { to: "+0000000000", message: "__health_check__", category: "health_check" },
      });
      setHealth({ connected: true, lastCheck: new Date(), latency: Date.now() - start });
    } catch {
      setHealth({ connected: false, lastCheck: new Date(), latency: null });
    }
    setChecking(false);
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
      <div className={`w-3 h-3 rounded-full ${health.connected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : health.lastCheck ? "bg-destructive" : "bg-muted-foreground"} ${!health.lastCheck ? "" : "animate-pulse"}`} />
      <div className="flex-1">
        <p className="text-xs font-medium text-foreground">{health.connected ? "Twilio Connected" : health.lastCheck ? "Connection Issue" : "Not Checked"}</p>
        {health.lastCheck && <p className="text-[10px] text-muted-foreground">{health.latency && `${health.latency}ms · `}Checked {formatDistanceToNow(health.lastCheck, { addSuffix: true })}</p>}
      </div>
      <button onClick={checkHealth} disabled={checking} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
        {checking ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Activity className="w-4 h-4 text-muted-foreground" />}
      </button>
    </div>
  );
};

// ─── Quick Stats Hero ───
const QuickStatsHero = () => {
  const [stats, setStats] = useState({ total: 0, delivered: 0, read: 0, failed: 0, today: 0, thisWeek: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = startOfDay(new Date()).toISOString();
      const weekAgo = subDays(new Date(), 7).toISOString();
      const [totalRes, deliveredRes, readRes, failedRes, todayRes, weekRes] = await Promise.all([
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "delivered"),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "read"),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "failed"),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).gte("created_at", today),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      ]);
      setStats({
        total: totalRes.count || 0, delivered: deliveredRes.count || 0, read: readRes.count || 0,
        failed: failedRes.count || 0, today: todayRes.count || 0, thisWeek: weekRes.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const readRate = stats.delivered > 0 ? Math.round((stats.read / stats.delivered) * 100) : 0;
  const failRate = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0;

  const metrics = [
    { label: "Total Messages", value: stats.total, icon: Send, gradient: "from-blue-500/20 to-blue-600/5", color: "text-blue-500", border: "border-blue-500/20" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle2, gradient: "from-green-500/20 to-green-600/5", color: "text-green-500", border: "border-green-500/20", sub: `${deliveryRate}%` },
    { label: "Read", value: stats.read, icon: Eye, gradient: "from-emerald-500/20 to-emerald-600/5", color: "text-emerald-400", border: "border-emerald-500/20", sub: `${readRate}%` },
    { label: "Failed", value: stats.failed, icon: XCircle, gradient: "from-red-500/20 to-red-600/5", color: "text-destructive", border: "border-red-500/20", sub: `${failRate}%` },
    { label: "Today", value: stats.today, icon: Zap, gradient: "from-primary/20 to-primary/5", color: "text-primary", border: "border-primary/20" },
    { label: "This Week", value: stats.thisWeek, icon: Calendar, gradient: "from-violet-500/20 to-violet-600/5", color: "text-violet-500", border: "border-violet-500/20" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((m, i) => <MiniStatCard key={m.label} {...m} />)}
    </div>
  );
};

// ─── Send Message Tab ───
const SendMessageTab = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"single" | "bulk" | "template" | "ai" | "schedule">("single");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    (supabase as any).from("whatsapp_templates").select("*").eq("is_active", true).order("name")
      .then(({ data }: any) => setTemplates(data || []));
  }, []);

  useEffect(() => {
    if (templateName) {
      const tmpl = templates.find(t => t.name === templateName);
      setSelectedTemplate(tmpl);
      if (tmpl?.variables) {
        const params: Record<string, string> = {};
        (tmpl.variables as string[]).forEach((v: string) => { params[v] = ""; });
        setTemplateParams(params);
      }
    } else { setSelectedTemplate(null); setTemplateParams({}); }
  }, [templateName, templates]);

  useEffect(() => { setCharCount(message.length); }, [message]);

  const generateAIMessage = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("memory-engine", {
        body: { type: "weekly_report", stats: { aiPrompt, context: "Generate a WhatsApp notification message. Keep it short, friendly, and within 300 characters. Include relevant emojis." } },
      });
      if (error) throw error;
      const content = data?.choices?.[0]?.message?.content || data?.result || "";
      setMessage(content.slice(0, 1600));
      setMode("single");
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e.message, variant: "destructive" });
    }
    setGeneratingAI(false);
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const numbers = mode === "bulk" ? bulkNumbers.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean) : [phone.trim()];
      if (numbers.length === 0 || numbers[0] === "") { toast({ title: "Enter phone number(s)", variant: "destructive" }); setSending(false); return; }
      const payload = numbers.map(num => ({
        to: num.startsWith("+") ? num : `+${num}`,
        message: mode === "template" ? undefined : message,
        template_name: mode === "template" ? templateName : undefined,
        template_params: mode === "template" ? templateParams : undefined,
        media_url: mediaUrl || undefined,
        category: "manual",
      }));
      const { data, error } = await supabase.functions.invoke("send-whatsapp", { body: payload.length === 1 ? payload[0] : payload });
      if (error) throw error;
      toast({ title: `✅ ${data.sent} sent, ${data.failed} failed`, description: data.failed > 0 ? "Check message history for details" : undefined });
      setMessage(""); setPhone(""); setBulkNumbers(""); setMediaUrl("");
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const previewText = selectedTemplate
    ? (() => { let text = selectedTemplate.body_template; const vars = (selectedTemplate.variables as string[]) || []; vars.forEach((v: string, i: number) => { text = text.replace(`{{${i + 1}}}`, templateParams[v] || `[${v}]`); }); return text; })()
    : message;

  const bulkCount = bulkNumbers.split(/[\n,;]+/).filter(n => n.trim()).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "single", label: "Single", icon: Phone, desc: "One recipient" },
          { key: "bulk", label: "Bulk", icon: Users, desc: "Multiple" },
          { key: "template", label: "Template", icon: FileText, desc: "Pre-built" },
          { key: "ai", label: "AI Compose", icon: Bot, desc: "AI-powered" },
          { key: "schedule", label: "Schedule", icon: Calendar, desc: "Send later" },
        ].map(m => (
          <motion.button key={m.key} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setMode(m.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === m.key ? "bg-green-600/15 text-green-500 border border-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.1)]" : "bg-secondary/50 text-muted-foreground border border-transparent hover:border-border"}`}>
            <m.icon className="w-4 h-4" />
            <div className="text-left"><p className="leading-none">{m.label}</p><p className="text-[9px] opacity-60">{m.desc}</p></div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {mode === "ai" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Describe your message</label>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  placeholder="e.g. Remind users about their weak topics and motivate them to study today..."
                  className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border border-border text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50" />
              </div>
              <button onClick={generateAIMessage} disabled={generatingAI || !aiPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-green-600/20">
                {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                {generatingAI ? "Generating..." : "Generate with AI"}
              </button>
            </div>
          ) : mode === "schedule" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Recipient</label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919876543210"
                    className="w-full pl-10 pr-3 py-3 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your WhatsApp message..."
                  className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border border-border text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Schedule Date & Time</label>
                <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
                <Clock className="w-4 h-4 text-yellow-500 mt-0.5" />
                <p className="text-[11px] text-muted-foreground">Scheduled messages are queued and will be sent at the specified time. Make sure Twilio cron jobs are configured.</p>
              </div>
              <button onClick={handleSend} disabled={sending || !scheduledAt}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-green-600/20">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Schedule Message
              </button>
            </div>
          ) : (
            <>
              {mode === "bulk" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">Phone Numbers <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-500 font-bold">{bulkCount}</span></label>
                  <textarea value={bulkNumbers} onChange={e => setBulkNumbers(e.target.value)}
                    placeholder={"+919876543210\n+919876543211\n+919876543212"}
                    className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border border-border text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono" />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Recipient</label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919876543210"
                      className="w-full pl-10 pr-3 py-3 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono" />
                  </div>
                </div>
              )}
              {mode === "template" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Template</label>
                    <select value={templateName} onChange={e => setTemplateName(e.target.value)}
                      className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50">
                      <option value="">Select template…</option>
                      {templates.map(t => <option key={t.id} value={t.name}>{t.name} — {t.description}</option>)}
                    </select>
                  </div>
                  {selectedTemplate && (selectedTemplate.variables as string[] || []).map((v: string) => (
                    <div key={v}>
                      <label className="text-xs font-medium text-muted-foreground capitalize">{v.replace(/_/g, " ")}</label>
                      <input value={templateParams[v] || ""} onChange={e => setTemplateParams(p => ({ ...p, [v]: e.target.value }))} placeholder={v}
                        className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Message</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your WhatsApp message..."
                    className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border border-border text-sm min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                  <div className="flex justify-between mt-1">
                    <p className="text-[10px] text-muted-foreground">{charCount}/1600</p>
                    <div className="h-1 w-24 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${charCount > 1400 ? "bg-destructive" : charCount > 1000 ? "bg-yellow-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min((charCount / 1600) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Image className="w-3 h-3" /> Media URL <span className="text-muted-foreground/50">(optional)</span></label>
                <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://example.com/image.jpg"
                  className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
            </>
          )}
          {mode !== "ai" && mode !== "schedule" && (
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleSend} disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-green-600/20">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending…" : mode === "bulk" ? `Send to ${bulkCount} Numbers` : "Send WhatsApp Message"}
            </motion.button>
          )}
        </div>

        {/* WhatsApp Preview */}
        <div className="bg-[#0b141a] rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34]">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold">ACRY Brain</p>
              <p className="text-green-400 text-[10px]">online</p>
            </div>
            <Phone className="w-4 h-4 text-white/50" />
          </div>
          <div className="p-4 min-h-[280px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=')]">
            {previewText ? (
              <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="flex justify-end">
                <div className="bg-[#005c4b] rounded-2xl rounded-tr-sm p-3.5 max-w-[85%] shadow-lg">
                  <p className="text-white text-xs whitespace-pre-wrap leading-relaxed">{previewText}</p>
                  {mediaUrl && (
                    <div className="mt-2 rounded-lg bg-white/10 p-2 flex items-center gap-2">
                      <Image className="w-4 h-4 text-white/60" />
                      <span className="text-white/60 text-[10px] truncate">{mediaUrl}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-1.5">
                    <p className="text-white/40 text-[9px]">{format(new Date(), "h:mm a")}</p>
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] gap-3">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center"><MessageSquare className="w-8 h-8 text-white/10" /></div>
                <p className="text-white/20 text-xs">Message preview will appear here</p>
              </div>
            )}
          </div>
          <div className="px-4 py-2 bg-[#1f2c34] flex items-center gap-2">
            <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2"><p className="text-white/30 text-xs">Type a message</p></div>
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center"><Send className="w-3.5 h-3.5 text-white" /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Message History Tab ───
const MessageHistoryTab = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("whatsapp_messages").select("*").order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
    const { data } = await query;
    setMessages(data || []);
    setLoading(false);
  }, [statusFilter, categoryFilter, page]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const filtered = messages.filter(m => !search || m.to_number?.includes(search) || m.content?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search number, content..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
          <option value="all">All Status</option>
          <option value="delivered">Delivered</option><option value="read">Read</option>
          <option value="sent">Sent</option><option value="failed">Failed</option><option value="queued">Queued</option>
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
          <option value="all">All Categories</option><option value="manual">Manual</option>
          <option value="risk_digest">Risk Digest</option><option value="study_reminder">Study Reminder</option>
          <option value="streak_milestone">Streak</option><option value="campaign">Campaign</option>
          <option value="lead_followup">Lead Follow-up</option><option value="exam_result">Exam Result</option>
          <option value="burnout_alert">Burnout Alert</option><option value="payment">Payment</option>
        </select>
        <button onClick={fetchMessages} className="p-2.5 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16"><MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-muted-foreground text-sm">No messages found</p></div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.map((msg, i) => (
              <motion.div key={msg.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-card/50 border border-border rounded-xl p-3 cursor-pointer hover:bg-card transition-colors group"
                onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-600/10 flex items-center justify-center flex-shrink-0 group-hover:bg-green-600/20 transition-colors">
                    <MessageSquare className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground font-mono">{msg.to_number}</span>
                      <StatusBadge status={msg.status} />
                      {msg.category && msg.category !== "manual" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{msg.category.replace(/_/g, " ")}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.content?.slice(0, 100)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}</p>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground mt-1 ml-auto transition-transform ${expanded === msg.id ? "rotate-180" : ""}`} />
                  </div>
                </div>
                <AnimatePresence>
                  {expanded === msg.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-3 pt-3 border-t border-border space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><p className="text-muted-foreground">Type</p><p className="text-foreground font-medium">{msg.message_type}</p></div>
                          <div className="space-y-1"><p className="text-muted-foreground">Twilio SID</p>
                            <div className="flex items-center gap-1"><p className="text-foreground font-mono text-[10px] truncate">{msg.twilio_sid || "—"}</p>
                              {msg.twilio_sid && <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.twilio_sid); }} className="p-0.5 hover:bg-secondary rounded"><Copy className="w-3 h-3 text-muted-foreground" /></button>}
                            </div>
                          </div>
                          <div className="space-y-1"><p className="text-muted-foreground">Created</p><p className="text-foreground">{format(new Date(msg.created_at), "PPp")}</p></div>
                          {msg.delivered_at && <div className="space-y-1"><p className="text-muted-foreground">Delivered</p><p className="text-green-500">{format(new Date(msg.delivered_at), "PPp")}</p></div>}
                          {msg.read_at && <div className="space-y-1"><p className="text-muted-foreground">Read</p><p className="text-emerald-400">{format(new Date(msg.read_at), "PPp")}</p></div>}
                          {msg.error_message && <div className="col-span-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20"><p className="text-destructive font-medium">Error {msg.error_code}: {msg.error_message}</p></div>}
                        </div>
                        {msg.content && <div className="bg-secondary/50 rounded-xl p-3 whitespace-pre-wrap text-foreground border border-border">{msg.content}</div>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors">Previous</button>
            <span className="text-xs text-muted-foreground px-3">Page {page + 1}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={messages.length < PAGE_SIZE}
              className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium text-foreground disabled:opacity-30 hover:bg-secondary/80 transition-colors">Next</button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Templates Tab ───
const TemplatesTab = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "", body_template: "", category: "general", variables: "" });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("whatsapp_templates").select("*").order("name");
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const toggleTemplate = async (id: string, active: boolean) => {
    await (supabase as any).from("whatsapp_templates").update({ is_active: !active }).eq("id", id);
    toast({ title: `Template ${!active ? "activated" : "deactivated"}` });
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    await (supabase as any).from("whatsapp_templates").delete().eq("id", id);
    toast({ title: "Template deleted" });
    fetchTemplates();
  };

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.body_template) { toast({ title: "Name and body required", variant: "destructive" }); return; }
    const vars = newTemplate.variables.split(",").map(v => v.trim()).filter(Boolean);
    await (supabase as any).from("whatsapp_templates").insert({
      name: newTemplate.name, description: newTemplate.description, body_template: newTemplate.body_template,
      category: newTemplate.category, variables: vars.length > 0 ? vars : null, is_active: true,
    });
    toast({ title: "Template created! ✅" });
    setNewTemplate({ name: "", description: "", body_template: "", category: "general", variables: "" });
    setCreating(false);
    fetchTemplates();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{templates.length} templates configured</p>
        <button onClick={() => setCreating(!creating)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600/15 text-green-500 text-xs font-medium hover:bg-green-600/25 transition-all border border-green-500/20">
          <Plus className="w-3.5 h-3.5" />{creating ? "Cancel" : "New Template"}
        </button>
      </div>

      <AnimatePresence>
        {creating && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="bg-card border border-green-500/20 rounded-2xl p-5 space-y-3 overflow-hidden">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <input value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="study_reminder"
                  className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select value={newTemplate.category} onChange={e => setNewTemplate(p => ({ ...p, category: e.target.value }))}
                  className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none">
                  <option value="general">General</option><option value="study">Study</option><option value="streak">Streak</option>
                  <option value="engagement">Engagement</option><option value="promotional">Promotional</option><option value="lead">Lead</option><option value="campaign">Campaign</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <input value={newTemplate.description} onChange={e => setNewTemplate(p => ({ ...p, description: e.target.value }))} placeholder="Short description..."
                className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Body Template</label>
              <textarea value={newTemplate.body_template} onChange={e => setNewTemplate(p => ({ ...p, body_template: e.target.value }))}
                placeholder={"Hey {{1}}! 🧠 Your topic {{2}} needs review. Memory is at {{3}}%."}
                className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border border-border text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Variables (comma-separated)</label>
              <input value={newTemplate.variables} onChange={e => setNewTemplate(p => ({ ...p, variables: e.target.value }))} placeholder="user_name, topic_name, memory_strength"
                className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
            </div>
            <button onClick={createTemplate}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-green-600/20 hover:from-green-700 hover:to-emerald-700 transition-all">Create Template</button>
          </motion.div>
        )}
      </AnimatePresence>

      {templates.map((t, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
          className={`bg-card border rounded-2xl p-4 transition-all ${t.is_active ? "border-green-500/20" : "border-border opacity-60"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className={`w-4 h-4 ${t.is_active ? "text-green-500" : "text-muted-foreground"}`} />
              <span className="text-sm font-bold text-foreground">{t.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase tracking-wider">{t.category}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </button>
              <button onClick={() => toggleTemplate(t.id, t.is_active)} className={`w-11 h-6 rounded-full transition-all relative ${t.is_active ? "bg-green-500" : "bg-secondary"}`}>
                <motion.div className="w-4 h-4 rounded-full bg-white absolute top-1 shadow-sm" animate={{ left: t.is_active ? 24 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t.description}</p>
          <div className="bg-[#0b141a] rounded-xl p-3 text-xs text-green-300/80 whitespace-pre-wrap font-mono border border-green-500/10">{t.body_template}</div>
          {t.variables?.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {(t.variables as string[]).map((v: string) => (
                <span key={v} className="text-[10px] px-2 py-1 rounded-lg bg-green-500/10 text-green-500 font-semibold border border-green-500/20">{`{{${v}}}`}</span>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

// ─── Lead Management Tab (Full CRM Pipeline) ───
const LeadManagementTab = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("leads").select("*, profiles:user_id(display_name, whatsapp_number)").order("score", { ascending: false }).limit(100);
    if (stageFilter !== "all") query = query.eq("stage", stageFilter);
    const { data } = await query;
    setLeads(data || []);
    setLoading(false);
  }, [stageFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const filtered = leads.filter(l => !search || l.profiles?.display_name?.toLowerCase().includes(search.toLowerCase()) || l.user_id?.includes(search));

  const stageConfig: Record<string, { color: string; icon: any; bg: string }> = {
    new: { color: "text-blue-500", icon: UserPlus, bg: "bg-blue-500/15" },
    active: { color: "text-green-500", icon: Activity, bg: "bg-green-500/15" },
    power_user: { color: "text-purple-500", icon: Crown, bg: "bg-purple-500/15" },
    at_risk: { color: "text-orange-500", icon: AlertTriangle, bg: "bg-orange-500/15" },
    churned: { color: "text-red-500", icon: TrendingDown, bg: "bg-red-500/15" },
  };

  const sendWhatsAppToLead = async (lead: any) => {
    const phone = lead.profiles?.whatsapp_number;
    if (!phone) { toast({ title: "No WhatsApp number", description: "This lead has no WhatsApp number configured", variant: "destructive" }); return; }
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { to: phone, message: `Hey ${lead.profiles?.display_name || "there"}! 👋 We noticed you've been studying hard. Keep up the great work! 🧠✨`, category: "lead_followup", user_id: lead.user_id },
      });
      if (error) throw error;
      toast({ title: "WhatsApp sent to lead! ✅" });
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    }
  };

  const bulkSendToLeads = async () => {
    if (selectedLeads.length === 0) { toast({ title: "Select leads first", variant: "destructive" }); return; }
    const leadsToSend = leads.filter(l => selectedLeads.includes(l.id) && l.profiles?.whatsapp_number);
    if (leadsToSend.length === 0) { toast({ title: "No leads with WhatsApp numbers", variant: "destructive" }); return; }
    try {
      const payload = leadsToSend.map(l => ({
        to: l.profiles.whatsapp_number,
        message: `Hey ${l.profiles?.display_name || "there"}! 👋 ${bulkAction === "followup" ? "Just checking in on your study progress. Need any help?" : bulkAction === "promo" ? "🎉 Special offer just for you! Upgrade to Pro for exclusive features." : "Keep learning with ACRY Brain! 🧠"}`,
        category: "lead_followup",
        user_id: l.user_id,
      }));
      const { data, error } = await supabase.functions.invoke("send-whatsapp", { body: payload });
      if (error) throw error;
      toast({ title: `✅ Sent to ${data.sent} leads` });
      setSelectedLeads([]);
    } catch (e: any) {
      toast({ title: "Bulk send failed", description: e.message, variant: "destructive" });
    }
  };

  const updateLeadStage = async (leadId: string, newStage: string) => {
    await (supabase as any).from("leads").update({ stage: newStage }).eq("id", leadId);
    toast({ title: `Lead moved to ${newStage.replace(/_/g, " ")}` });
    fetchLeads();
  };

  const stageStats = useMemo(() => {
    const counts: Record<string, number> = { new: 0, active: 0, power_user: 0, at_risk: 0, churned: 0 };
    leads.forEach(l => { counts[l.stage] = (counts[l.stage] || 0) + 1; });
    return counts;
  }, [leads]);

  return (
    <div className="space-y-4">
      <SectionHeader icon={Users} title="WhatsApp Lead Pipeline" subtitle="Full CRM with WhatsApp touchpoints at every stage" />

      {/* Funnel Stats */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(stageConfig).map(([stage, cfg]) => (
          <motion.div key={stage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => setStageFilter(stageFilter === stage ? "all" : stage)}
            className={`text-center p-3 rounded-xl border cursor-pointer transition-all ${stageFilter === stage ? `${cfg.bg} border-current ${cfg.color}` : "bg-card/50 border-border hover:border-green-500/20"}`}>
            <cfg.icon className={`w-5 h-5 mx-auto mb-1 ${cfg.color}`} />
            <p className="text-lg font-bold text-foreground">{stageStats[stage] || 0}</p>
            <p className="text-[9px] text-muted-foreground capitalize">{stage.replace(/_/g, " ")}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters & Bulk */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
        </div>
        {selectedLeads.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-500 font-bold">{selectedLeads.length} selected</span>
            <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
              className="px-2 py-2 rounded-xl bg-secondary/50 border border-border text-xs text-foreground">
              <option value="">Bulk Action...</option><option value="followup">Follow Up</option>
              <option value="promo">Promo Message</option><option value="engagement">Engagement Nudge</option>
            </select>
            <button onClick={bulkSendToLeads} disabled={!bulkAction}
              className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-medium disabled:opacity-50 hover:bg-green-700 transition-colors flex items-center gap-1">
              <Send className="w-3 h-3" /> Send to All
            </button>
          </div>
        )}
        <button onClick={fetchLeads} className="p-2.5 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-muted-foreground text-sm">No leads found</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead, i) => {
            const cfg = stageConfig[lead.stage] || stageConfig.new;
            const isSelected = selectedLeads.includes(lead.id);
            return (
              <motion.div key={lead.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                className={`bg-card/50 border rounded-xl p-4 transition-all ${isSelected ? "border-green-500/30 bg-green-500/5" : "border-border hover:border-green-500/10"}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={isSelected}
                    onChange={() => setSelectedLeads(prev => isSelected ? prev.filter(id => id !== lead.id) : [...prev, lead.id])}
                    className="rounded border-border" />
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                    <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{lead.profiles?.display_name || "Unknown"}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} font-semibold capitalize`}>{lead.stage.replace(/_/g, " ")}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Score: {lead.score}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      {lead.streak_days && <span className="flex items-center gap-0.5"><Flame className="w-3 h-3 text-orange-500" />{lead.streak_days}d streak</span>}
                      {lead.study_hours_7d && <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3" />{lead.study_hours_7d.toFixed(1)}h/7d</span>}
                      {lead.subscription_plan && <span className="flex items-center gap-0.5"><Crown className="w-3 h-3 text-yellow-500" />{lead.subscription_plan}</span>}
                      {lead.profiles?.whatsapp_number && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3 text-green-500" />{lead.profiles.whatsapp_number}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select value={lead.stage} onChange={e => updateLeadStage(lead.id, e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-secondary/50 border border-border text-[10px] text-foreground">
                      <option value="new">New</option><option value="active">Active</option><option value="power_user">Power User</option>
                      <option value="at_risk">At Risk</option><option value="churned">Churned</option>
                    </select>
                    <button onClick={() => sendWhatsAppToLead(lead)} title="Send WhatsApp"
                      className="p-2 rounded-xl bg-green-600/10 hover:bg-green-600/20 transition-colors border border-green-500/20">
                      <Send className="w-3.5 h-3.5 text-green-500" />
                    </button>
                  </div>
                </div>
                {lead.tags && lead.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 ml-14">
                    {lead.tags.map((tag: string) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{tag}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── WhatsApp Campaign Triggers ───
const WA_CAMPAIGN_TRIGGERS = [
  { key: "study_reminder", label: "Study Reminder", icon: "📚", desc: "Topics due for revision" },
  { key: "forget_risk", label: "Forget Risk Alert", icon: "⚠️", desc: "Memory score dropping" },
  { key: "risk_digest", label: "Daily Risk Digest", icon: "📊", desc: "At-risk topics summary" },
  { key: "streak_milestone", label: "Streak Milestone", icon: "🔥", desc: "Celebrate streaks" },
  { key: "streak_break_warning", label: "Streak Break Warning", icon: "💔", desc: "Streak about to break" },
  { key: "brain_update_reminder", label: "Brain Update Nudge", icon: "🧠", desc: "No brain update in 24h" },
  { key: "daily_briefing", label: "Daily Briefing", icon: "🌅", desc: "Morning cognitive summary" },
  { key: "brain_missions", label: "Brain Missions", icon: "🎯", desc: "New AI learning missions" },
  { key: "weekly_insights", label: "Weekly Insights", icon: "📈", desc: "AI study recommendations" },
  { key: "exam_countdown", label: "Exam Countdown", icon: "⏰", desc: "Exam date approaching" },
  { key: "burnout_detection", label: "Burnout Alert", icon: "😮‍💨", desc: "High fatigue detected" },
  { key: "subscription_expiry", label: "Sub Expiry", icon: "💳", desc: "Subscription expiring" },
  { key: "new_user_welcome", label: "Welcome Message", icon: "👋", desc: "Onboarding message" },
  { key: "inactivity_nudge", label: "Inactivity Nudge", icon: "💤", desc: "3+ days inactive" },
  { key: "leaderboard_rank_up", label: "Rank Up", icon: "🏅", desc: "Leaderboard climb" },
  { key: "promo_seasonal", label: "Seasonal Promo", icon: "🎉", desc: "Seasonal offer" },
  { key: "promo_upgrade", label: "Upgrade Promo", icon: "⬆️", desc: "Encourage upgrade" },
  { key: "promo_referral", label: "Referral Promo", icon: "🤝", desc: "Invite friends" },
  { key: "promo_reengagement", label: "Re-engagement", icon: "🔄", desc: "Win back churned users" },
];

// ─── AI Campaign Management Tab ───
const CampaignManagementTab = () => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [targetPlan, setTargetPlan] = useState<"all" | "free" | "pro" | "ultra">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subTab, setSubTab] = useState<"ai" | "ab" | "drip" | "list">("ai");

  // A/B Test state
  const [abTrigger, setAbTrigger] = useState("");
  const [abVariantCount, setAbVariantCount] = useState(2);
  const [abVariants, setAbVariants] = useState<{ subject: string; body: string }[]>([]);
  const [abGenerating, setAbGenerating] = useState(false);
  const [abSending, setAbSending] = useState(false);
  const [abSplitRatio, setAbSplitRatio] = useState(50);

  // Drip state
  const [drips, setDrips] = useState<any[]>([]);
  const [creatingDrip, setCreatingDrip] = useState(false);
  const [newDrip, setNewDrip] = useState({ name: "", trigger_event: "signup", steps: [{ delay_hours: 0, message: "" }, { delay_hours: 24, message: "" }] });
  const [generatingDrip, setGeneratingDrip] = useState(false);

  // Live updates
  const [liveUpdates, setLiveUpdates] = useState<{ id: string; field: string; value: any; at: Date }[]>([]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("campaigns").select("*").eq("channel", "whatsapp").order("created_at", { ascending: false }).limit(50);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setCampaigns(data || []);
    setLoading(false);
  }, [statusFilter]);

  const fetchDrips = useCallback(async () => {
    const { data } = await (supabase as any).from("drip_sequences").select("*").eq("channel", "whatsapp").order("created_at", { ascending: false });
    setDrips(data || []);
  }, []);

  useEffect(() => { fetchCampaigns(); fetchDrips(); }, [fetchCampaigns, fetchDrips]);

  // Real-time tracking
  useEffect(() => {
    const channel = supabase.channel('wa-campaign-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns' }, (payload) => {
        const updated = payload.new as any;
        if (updated.channel === "whatsapp") {
          setCampaigns(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
          setLiveUpdates(prev => [{ id: updated.id, field: 'status', value: updated.status, at: new Date() }, ...prev.slice(0, 9)]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaigns' }, (payload) => {
        const nc = payload.new as any;
        if (nc.channel === "whatsapp") {
          setCampaigns(prev => [nc, ...prev]);
          setLiveUpdates(prev => [{ id: nc.id, field: 'created', value: nc.name, at: new Date() }, ...prev.slice(0, 9)]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // One-click AI WhatsApp campaign
  const createAICampaign = async (triggerKey: string) => {
    setCreating(triggerKey);
    try {
      const { data: aiContent, error: aiErr } = await supabase.functions.invoke("generate-campaign-templates", {
        body: { action: "generate_campaign", trigger_key: triggerKey, channel: "push", custom_context: "Generate a WhatsApp message (max 300 chars, include emojis, friendly conversational tone). This will be sent via WhatsApp Business API." },
      });
      if (aiErr) throw aiErr;

      let query = (supabase as any).from("profiles").select("id, whatsapp_number, display_name").not("whatsapp_number", "is", null);
      if (targetPlan === "pro") query = query.eq("subscription_plan", "pro");
      if (targetPlan === "ultra") query = query.eq("subscription_plan", "ultra");
      if (targetPlan === "free") query = query.or("subscription_plan.is.null,subscription_plan.eq.free");
      const { data: users } = await query.limit(500);

      if (!users || users.length === 0) { toast({ title: "No users with WhatsApp numbers found", variant: "destructive" }); setCreating(null); return; }

      const isScheduled = scheduleMode && scheduleDate;
      const scheduledAt = isScheduled ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : null;

      const messageBody = (aiContent.html_body || aiContent.subject || "").replace(/<[^>]+>/g, "").slice(0, 1600);

      const { data: user } = await supabase.auth.getUser();
      const { data: campaign, error: campErr } = await (supabase as any).from("campaigns").insert({
        name: `[AI WA] ${aiContent.subject || triggerKey}${targetPlan !== "all" ? ` (${targetPlan})` : ""}`,
        channel: "whatsapp", status: isScheduled ? "scheduled" : "sent",
        subject: aiContent.subject || "", body: messageBody,
        audience_type: targetPlan === "all" ? "all" : "segment",
        audience_filters: targetPlan !== "all" ? { plan: targetPlan } : {},
        total_recipients: users.length,
        scheduled_at: scheduledAt, sent_at: isScheduled ? null : new Date().toISOString(),
        created_by: user?.user?.id,
      }).select().single();
      if (campErr) throw campErr;

      if (!isScheduled) {
        // Send via Twilio
        const payload = users.map((u: any) => ({
          to: u.whatsapp_number, message: messageBody.replace("{{name}}", u.display_name || "there"),
          category: "campaign", user_id: u.id,
        }));
        const { data: sendResult, error: sendErr } = await supabase.functions.invoke("send-whatsapp", { body: payload });
        if (sendErr) throw sendErr;

        await (supabase as any).from("campaigns").update({
          delivered_count: sendResult.sent, failed_count: sendResult.failed,
        }).eq("id", campaign.id);

        toast({ title: `🚀 WhatsApp AI campaign sent to ${sendResult.sent} users!` });
      } else {
        toast({ title: `📅 Campaign scheduled for ${format(new Date(scheduledAt!), "PPp")}` });
      }
      fetchCampaigns();
    } catch (e: any) {
      toast({ title: "AI campaign failed", description: e?.message, variant: "destructive" });
    }
    setCreating(null);
  };

  // A/B Test
  const generateABVariants = async () => {
    if (!abTrigger) return;
    setAbGenerating(true);
    try {
      const variants: { subject: string; body: string }[] = [];
      for (let i = 0; i < abVariantCount; i++) {
        const { data, error } = await supabase.functions.invoke("generate-campaign-templates", {
          body: { action: "generate_single", trigger_key: abTrigger, channel: "push",
            custom_context: `Generate WhatsApp message variant ${String.fromCharCode(65 + i)} — use a ${i === 0 ? "direct and urgent" : i === 1 ? "friendly and casual" : "data-driven"} tone. Max 300 chars with emojis.` },
        });
        if (error) throw error;
        variants.push({ subject: data.subject || `Variant ${String.fromCharCode(65 + i)}`, body: (data.html_body || "").replace(/<[^>]+>/g, "").slice(0, 1600) });
      }
      setAbVariants(variants);
      toast({ title: `🧪 ${variants.length} AI WhatsApp variants generated!` });
    } catch (e: any) { toast({ title: "Variant generation failed", description: e?.message, variant: "destructive" }); }
    setAbGenerating(false);
  };

  const sendABCampaign = async () => {
    if (abVariants.length < 2) return;
    setAbSending(true);
    try {
      const { data: users } = await (supabase as any).from("profiles").select("id, whatsapp_number, display_name").not("whatsapp_number", "is", null).limit(500);
      if (!users || users.length === 0) { toast({ title: "No WhatsApp users found", variant: "destructive" }); setAbSending(false); return; }

      const shuffled = [...users].sort(() => Math.random() - 0.5);
      const splitIdx = Math.floor(shuffled.length * (abSplitRatio / 100));
      const groups = abVariantCount === 2
        ? [shuffled.slice(0, splitIdx), shuffled.slice(splitIdx)]
        : [shuffled.slice(0, Math.floor(shuffled.length / 3)), shuffled.slice(Math.floor(shuffled.length / 3), Math.floor(shuffled.length * 2 / 3)), shuffled.slice(Math.floor(shuffled.length * 2 / 3))];

      const { data: user } = await supabase.auth.getUser();
      const { data: campaign } = await (supabase as any).from("campaigns").insert({
        name: `[AI WA A/B] ${abTrigger}`, channel: "whatsapp", status: "sent",
        subject: abVariants[0].subject, body: abVariants[0].body,
        audience_type: "all", total_recipients: users.length,
        sent_at: new Date().toISOString(), created_by: user?.user?.id,
        is_ab_test: true, ab_variants: abVariants.map((v, i) => ({ variant: String.fromCharCode(65 + i), subject: v.subject, body: v.body, audience_size: groups[i]?.length || 0 })),
      }).select().single();

      // Send each variant group
      let totalSent = 0;
      for (let vi = 0; vi < groups.length; vi++) {
        const payload = groups[vi].map((u: any) => ({
          to: u.whatsapp_number, message: abVariants[vi].body.replace("{{name}}", u.display_name || "there"),
          category: "campaign", user_id: u.id,
        }));
        if (payload.length > 0) {
          const { data: result } = await supabase.functions.invoke("send-whatsapp", { body: payload });
          totalSent += result?.sent || 0;
        }
        // Insert recipients
        const recipients = groups[vi].map((u: any) => ({ campaign_id: campaign.id, user_id: u.id, status: "delivered", delivered_at: new Date().toISOString(), ab_variant: String.fromCharCode(65 + vi) }));
        for (let i = 0; i < recipients.length; i += 50) {
          await (supabase as any).from("campaign_recipients").insert(recipients.slice(i, i + 50));
        }
      }

      await (supabase as any).from("campaigns").update({ delivered_count: totalSent }).eq("id", campaign.id);
      toast({ title: `🧪 A/B WhatsApp campaign sent to ${totalSent} users!` });
      setAbVariants([]); setAbTrigger("");
      fetchCampaigns();
    } catch (e: any) { toast({ title: "A/B campaign failed", description: e?.message, variant: "destructive" }); }
    setAbSending(false);
  };

  // Drip Sequences
  const generateDripContent = async () => {
    setGeneratingDrip(true);
    try {
      const steps = [];
      for (let i = 0; i < newDrip.steps.length; i++) {
        const { data, error } = await supabase.functions.invoke("generate-campaign-templates", {
          body: { action: "generate_single", trigger_key: newDrip.trigger_event, channel: "push",
            custom_context: `WhatsApp drip step ${i + 1}/${newDrip.steps.length}. Delay: ${newDrip.steps[i].delay_hours}h. ${i === 0 ? "Welcome/intro tone" : i === newDrip.steps.length - 1 ? "Final nudge, create urgency" : "Follow-up, add value"}. Max 300 chars with emojis.` },
        });
        if (error) throw error;
        steps.push({ ...newDrip.steps[i], message: (data.html_body || data.subject || "").replace(/<[^>]+>/g, "").slice(0, 600) });
      }
      setNewDrip(prev => ({ ...prev, steps }));
      toast({ title: "🤖 AI generated all drip steps!" });
    } catch (e: any) { toast({ title: "AI drip generation failed", description: e?.message, variant: "destructive" }); }
    setGeneratingDrip(false);
  };

  const saveDrip = async () => {
    if (!newDrip.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    const { data: user } = await supabase.auth.getUser();
    await (supabase as any).from("drip_sequences").insert({
      name: newDrip.name, channel: "whatsapp", trigger_event: newDrip.trigger_event,
      steps: newDrip.steps, status: "active", created_by: user?.user?.id,
    });
    toast({ title: "Drip sequence created! ✅" });
    setCreatingDrip(false);
    setNewDrip({ name: "", trigger_event: "signup", steps: [{ delay_hours: 0, message: "" }, { delay_hours: 24, message: "" }] });
    fetchDrips();
  };

  const cancelCampaign = async (id: string) => {
    await (supabase as any).from("campaigns").update({ status: "cancelled" }).eq("id", id);
    toast({ title: "Campaign cancelled" }); fetchCampaigns();
  };

  const campaignStatusConfig: Record<string, { color: string; bg: string }> = {
    draft: { color: "text-muted-foreground", bg: "bg-muted/15" },
    scheduled: { color: "text-blue-500", bg: "bg-blue-500/15" },
    sending: { color: "text-yellow-500", bg: "bg-yellow-500/15" },
    sent: { color: "text-green-500", bg: "bg-green-500/15" },
    cancelled: { color: "text-destructive", bg: "bg-destructive/15" },
    failed: { color: "text-destructive", bg: "bg-destructive/15" },
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Megaphone} title="AI WhatsApp Campaign Center" subtitle="One-click AI campaigns • A/B Tests • Drip Sequences • Real-time tracking" />

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "ai", label: "AI Campaigns", icon: Sparkles },
          { key: "ab", label: "A/B Tests", icon: Target },
          { key: "drip", label: "Drip Sequences", icon: GitBranch },
          { key: "list", label: "All Campaigns", icon: Layers },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              subTab === t.key ? "bg-green-600/15 text-green-500 border border-green-500/30" : "bg-secondary/50 text-muted-foreground border border-transparent hover:border-border"
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Live Activity Feed */}
      {liveUpdates.length > 0 && (
        <div className="bg-card/50 border border-green-500/10 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-500">LIVE</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {liveUpdates.slice(0, 5).map((u, i) => (
              <span key={i} className="text-[9px] px-2 py-1 rounded-full bg-green-500/10 text-green-400 whitespace-nowrap flex-shrink-0">
                {u.field === "created" ? `📢 ${u.value}` : `${u.field}: ${u.value}`} · {formatDistanceToNow(u.at, { addSuffix: true })}
              </span>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── AI Campaigns Sub-tab ── */}
        {subTab === "ai" && (
          <motion.div key="ai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-card border border-green-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-bold text-foreground">One-Click AI WhatsApp Campaign</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-bold">100% AI</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Select trigger → AI writes WhatsApp message → sends or schedules automatically to all opted-in users.</p>

              {/* Schedule toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                <button onClick={() => setScheduleMode(!scheduleMode)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    scheduleMode ? "bg-green-600/15 text-green-500 border border-green-500/30" : "bg-secondary text-muted-foreground border border-border"
                  }`}>
                  <Calendar className="w-3.5 h-3.5" />{scheduleMode ? "Scheduled" : "Send Now"}
                </button>
                {scheduleMode && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                      min={format(new Date(), "yyyy-MM-dd")}
                      className="px-2 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground" />
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                      className="px-2 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground" />
                  </div>
                )}
              </div>

              {/* Target Plan */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1"><Filter className="w-3 h-3" />Target:</span>
                <div className="flex gap-1">
                  {(["all", "free", "pro", "ultra"] as const).map(plan => (
                    <button key={plan} onClick={() => setTargetPlan(plan)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all ${
                        targetPlan === plan
                          ? "bg-green-600/15 text-green-500 border border-green-500/30"
                          : "text-muted-foreground hover:bg-secondary border border-transparent"
                      }`}>
                      {plan === "all" ? "👥 All" : plan === "free" ? "Free" : plan === "pro" ? "⭐ Pro" : "💎 Ultra"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                {WA_CAMPAIGN_TRIGGERS.map(trigger => (
                  <div key={trigger.key}
                    className={`rounded-xl p-3 border transition-all cursor-pointer ${
                      selectedTrigger === trigger.key ? "bg-green-500/10 border-green-500/30" : "bg-secondary/50 border-border hover:border-green-500/20"
                    }`}
                    onClick={() => setSelectedTrigger(selectedTrigger === trigger.key ? null : trigger.key)}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{trigger.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{trigger.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{trigger.desc}</p>
                      </div>
                    </div>
                    {selectedTrigger === trigger.key && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2">
                        <button onClick={(e) => { e.stopPropagation(); createAICampaign(trigger.key); }}
                          disabled={!!creating || (scheduleMode && !scheduleDate)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-green-600/20">
                          {creating === trigger.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {creating === trigger.key ? (scheduleMode ? "Scheduling..." : "Generating & Sending...") : (scheduleMode ? "Schedule WhatsApp" : "Send WhatsApp Now")}
                        </button>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── A/B Test Sub-tab ── */}
        {subTab === "ab" && (
          <motion.div key="ab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="bg-card border border-green-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-bold text-foreground">WhatsApp A/B Test Creator</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-bold">AI Variants</span>
              </div>
              <p className="text-[11px] text-muted-foreground">AI generates distinct WhatsApp message variants → audience auto-splits → track delivery & read rates per variant.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Trigger</label>
                  <select value={abTrigger} onChange={e => { setAbTrigger(e.target.value); setAbVariants([]); }}
                    className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50">
                    <option value="">Select trigger...</option>
                    {WA_CAMPAIGN_TRIGGERS.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Variants & Split</label>
                  <div className="flex gap-2">
                    {[2, 3].map(n => (
                      <button key={n} onClick={() => { setAbVariantCount(n); setAbVariants([]); }}
                        className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          abVariantCount === n ? "bg-green-600/15 text-green-500 border border-green-500/30" : "bg-secondary/50 text-muted-foreground border border-border"
                        }`}>
                        {n} Variants
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {abVariantCount === 2 && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Split:</span>
                  <input type="range" min={20} max={80} value={abSplitRatio} onChange={e => setAbSplitRatio(Number(e.target.value))} className="w-32 h-1.5 accent-green-500" />
                  <span className="text-[10px] font-bold text-foreground">{abSplitRatio}% / {100 - abSplitRatio}%</span>
                </div>
              )}

              <button onClick={generateABVariants} disabled={!abTrigger || abGenerating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-green-600/20">
                {abGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                {abGenerating ? `Generating ${abVariantCount} variants...` : `Generate ${abVariantCount} AI WhatsApp Variants`}
              </button>

              {abVariants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-green-500" />Generated Variants</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {abVariants.map((v, i) => (
                      <div key={i} className="rounded-xl border border-border p-3 bg-secondary/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-[10px] font-bold">{String.fromCharCode(65 + i)}</span>
                          <span className="text-[10px] font-bold text-foreground">Variant {String.fromCharCode(65 + i)}</span>
                          <span className="text-[9px] text-muted-foreground ml-auto">{abVariantCount === 2 ? (i === 0 ? `${abSplitRatio}%` : `${100 - abSplitRatio}%`) : "33%"}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{v.body.slice(0, 200)}{v.body.length > 200 ? "..." : ""}</p>
                        <textarea value={v.body} onChange={e => setAbVariants(prev => prev.map((vr, vi) => vi === i ? { ...vr, body: e.target.value } : vr))}
                          className="w-full px-2 py-1.5 rounded-xl bg-background border border-border text-[10px] text-foreground min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50"
                          placeholder="Edit message..." />
                      </div>
                    ))}
                  </div>
                  <button onClick={sendABCampaign} disabled={abSending}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white disabled:opacity-50 shadow-lg shadow-green-600/20">
                    {abSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {abSending ? "Sending A/B..." : `Send A/B WhatsApp Test (${abVariantCount} variants)`}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Drip Sequences Sub-tab ── */}
        {subTab === "drip" && (
          <motion.div key="drip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{drips.length} drip sequences configured</p>
              <button onClick={() => setCreatingDrip(!creatingDrip)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600/15 text-green-500 text-xs font-medium hover:bg-green-600/25 transition-all border border-green-500/20">
                <Plus className="w-3.5 h-3.5" />{creatingDrip ? "Cancel" : "New Drip Sequence"}
              </button>
            </div>

            <AnimatePresence>
              {creatingDrip && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="bg-card border border-green-500/20 rounded-2xl p-5 space-y-4 overflow-hidden">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Sequence Name</label>
                      <input value={newDrip.name} onChange={e => setNewDrip(p => ({ ...p, name: e.target.value }))} placeholder="Welcome WhatsApp Series"
                        className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Trigger Event</label>
                      <select value={newDrip.trigger_event} onChange={e => setNewDrip(p => ({ ...p, trigger_event: e.target.value }))}
                        className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
                        <option value="signup">User Signup</option><option value="first_study">First Study</option>
                        <option value="subscription">New Subscription</option><option value="streak_lost">Streak Lost</option>
                        <option value="inactivity_3d">3-Day Inactivity</option><option value="exam_registered">Exam Registered</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><GitBranch className="w-3 h-3" />Steps ({newDrip.steps.length})</label>
                      <div className="flex gap-2">
                        <button onClick={() => setNewDrip(p => ({ ...p, steps: [...p.steps, { delay_hours: (p.steps.at(-1)?.delay_hours || 0) + 24, message: "" }] }))}
                          className="text-[10px] px-2 py-1 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/80">+ Add Step</button>
                        <button onClick={generateDripContent} disabled={generatingDrip}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-green-600/15 text-green-500 hover:bg-green-600/25 border border-green-500/20">
                          {generatingDrip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                          AI Write All
                        </button>
                      </div>
                    </div>
                    {newDrip.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
                          {i < newDrip.steps.length - 1 && <div className="w-0.5 h-6 bg-green-500/20 mt-1" />}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">Delay:</span>
                            <input type="number" value={step.delay_hours} min={0}
                              onChange={e => setNewDrip(p => ({ ...p, steps: p.steps.map((s, si) => si === i ? { ...s, delay_hours: Number(e.target.value) } : s) }))}
                              className="w-16 px-2 py-1 rounded-lg bg-secondary/50 border border-border text-xs text-foreground" />
                            <span className="text-[10px] text-muted-foreground">hours</span>
                            {i > 1 && (
                              <button onClick={() => setNewDrip(p => ({ ...p, steps: p.steps.filter((_, si) => si !== i) }))}
                                className="ml-auto p-1 rounded hover:bg-destructive/10"><Trash2 className="w-3 h-3 text-muted-foreground" /></button>
                            )}
                          </div>
                          <textarea value={step.message} onChange={e => setNewDrip(p => ({ ...p, steps: p.steps.map((s, si) => si === i ? { ...s, message: e.target.value } : s) }))}
                            placeholder={`Step ${i + 1} WhatsApp message...`}
                            className="w-full p-2 rounded-xl bg-secondary/50 border border-border text-xs min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button onClick={saveDrip}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-green-600/20 hover:from-green-700 hover:to-emerald-700 transition-all">
                    Save Drip Sequence
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Existing drips */}
            {drips.length === 0 && !creatingDrip ? (
              <div className="text-center py-12"><GitBranch className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-muted-foreground text-sm">No WhatsApp drip sequences yet</p></div>
            ) : (
              <div className="space-y-2">
                {drips.map((drip, i) => (
                  <motion.div key={drip.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-bold text-foreground">{drip.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${drip.status === "active" ? "bg-green-500/15 text-green-500" : "bg-muted text-muted-foreground"}`}>{drip.status}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{(drip.steps as any[])?.length || 0} steps</span>
                        <span>·</span>
                        <span>Trigger: {drip.trigger_event}</span>
                        {drip.total_enrolled > 0 && <><span>·</span><span>{drip.total_enrolled} enrolled</span></>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── All Campaigns List Sub-tab ── */}
        {subTab === "list" && (
          <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
                <option value="all">All Status</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option>
                <option value="sent">Sent</option><option value="cancelled">Cancelled</option>
              </select>
              <button onClick={fetchCampaigns} className="p-2.5 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
                <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              </button>
              <div className="ml-auto flex gap-2">
                {Object.entries(campaignStatusConfig).map(([status, cfg]) => {
                  const count = campaigns.filter(c => c.status === status).length;
                  return count > 0 ? <span key={status} className={`text-[10px] px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color} font-semibold capitalize`}>{status} ({count})</span> : null;
                })}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12"><Megaphone className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" /><p className="text-muted-foreground text-sm">No WhatsApp campaigns yet</p></div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c, i) => {
                  const cfg = campaignStatusConfig[c.status] || campaignStatusConfig.draft;
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <MessageSquare className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-bold text-foreground">{c.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} font-semibold capitalize`}>{c.status}</span>
                          {c.is_ab_test && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold">A/B</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {c.status === "scheduled" && (
                            <button onClick={() => cancelCampaign(c.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-colors">
                              <Pause className="w-3 h-3" />Cancel
                            </button>
                          )}
                          {c.status === "draft" && (
                            <button onClick={() => { setSubTab("ai"); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-[10px] font-medium hover:bg-green-700 transition-colors">
                              <Send className="w-3 h-3" />Launch
                            </button>
                          )}
                          <button onClick={async () => { await (supabase as any).from("campaigns").delete().eq("id", c.id); fetchCampaigns(); }}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      {c.body && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{c.body.replace(/<[^>]+>/g, "").slice(0, 200)}</p>}
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.audience_type}</span>
                        {c.total_recipients > 0 && <span className="flex items-center gap-1"><Send className="w-3 h-3" />{c.total_recipients} recipients</span>}
                        {c.delivered_count > 0 && <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="w-3 h-3" />{c.delivered_count} delivered</span>}
                        {c.failed_count > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="w-3 h-3" />{c.failed_count} failed</span>}
                        {c.scheduled_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(c.scheduled_at), "PPp")}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </div>
                      {/* A/B Variant details */}
                      {c.is_ab_test && c.ab_variants && (
                        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
                          {(c.ab_variants as any[]).map((v: any, vi: number) => (
                            <div key={vi} className="p-2 rounded-xl bg-secondary/30 border border-border">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center text-[9px] font-bold">{v.variant}</span>
                                <span className="text-[10px] font-medium text-foreground">{v.audience_size} users</span>
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">{(v.body || v.subject || "").replace(/<[^>]+>/g, "").slice(0, 100)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
// ─── Advanced Analytics Tab ───
const AdvancedAnalyticsTab = () => {
  const [daily, setDaily] = useState<{ date: string; sent: number; delivered: number; failed: number; read: number }[]>([]);
  const [topCategories, setTopCategories] = useState<{ category: string; count: number }[]>([]);
  const [hourlyHeatmap, setHourlyHeatmap] = useState<number[]>(new Array(24).fill(0));
  const [responseTime, setResponseTime] = useState({ avg: 0, median: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const last14 = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
      const { data: msgs } = await (supabase as any).from("whatsapp_messages").select("status, category, created_at, delivered_at, read_at")
        .gte("created_at", subDays(new Date(), 14).toISOString()).order("created_at", { ascending: true });
      const messages = msgs || [];

      // Daily
      const dailyMap: Record<string, { sent: number; delivered: number; failed: number; read: number }> = {};
      last14.forEach(d => { const key = format(d, "yyyy-MM-dd"); dailyMap[key] = { sent: 0, delivered: 0, failed: 0, read: 0 }; });
      messages.forEach((m: any) => {
        const key = format(new Date(m.created_at), "yyyy-MM-dd");
        if (dailyMap[key]) { dailyMap[key].sent++; if (m.status === "delivered" || m.status === "read") dailyMap[key].delivered++; if (m.status === "failed") dailyMap[key].failed++; if (m.status === "read") dailyMap[key].read++; }
      });
      setDaily(Object.entries(dailyMap).map(([date, vals]) => ({ date, ...vals })));

      // Categories
      const catMap: Record<string, number> = {};
      messages.forEach((m: any) => { const cat = m.category || "manual"; catMap[cat] = (catMap[cat] || 0) + 1; });
      setTopCategories(Object.entries(catMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count));

      // Hourly heatmap
      const hourly = new Array(24).fill(0);
      messages.forEach((m: any) => { hourly[new Date(m.created_at).getHours()]++; });
      setHourlyHeatmap(hourly);

      // Response times
      const responseTimes = messages.filter((m: any) => m.delivered_at).map((m: any) => (new Date(m.delivered_at).getTime() - new Date(m.created_at).getTime()) / 1000);
      if (responseTimes.length > 0) {
        responseTimes.sort((a: number, b: number) => a - b);
        setResponseTime({ avg: Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length), median: Math.round(responseTimes[Math.floor(responseTimes.length / 2)]) });
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const maxSent = Math.max(...daily.map(d => d.sent), 1);
  const totalSent = daily.reduce((a, d) => a + d.sent, 0);
  const totalDelivered = daily.reduce((a, d) => a + d.delivered, 0);
  const totalRead = daily.reduce((a, d) => a + d.read, 0);
  const totalFailed = daily.reduce((a, d) => a + d.failed, 0);
  const maxHour = Math.max(...hourlyHeatmap, 1);

  return (
    <div className="space-y-5">
      <SectionHeader icon={BarChart3} title="Advanced WhatsApp Analytics" subtitle="14-day deep insights with AI-powered analysis" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStatCard label="Total Sent" value={totalSent} icon={Send} color="text-blue-500" border="border-blue-500/20" gradient="from-blue-500/20 to-blue-600/5" />
        <MiniStatCard label="Delivered" value={totalDelivered} icon={CheckCircle2} color="text-green-500" border="border-green-500/20" gradient="from-green-500/20 to-green-600/5" sub={`${totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0}%`} />
        <MiniStatCard label="Read" value={totalRead} icon={Eye} color="text-emerald-400" border="border-emerald-500/20" gradient="from-emerald-500/20 to-emerald-600/5" sub={`${totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0}%`} />
        <MiniStatCard label="Failed" value={totalFailed} icon={XCircle} color="text-destructive" border="border-red-500/20" gradient="from-red-500/20 to-red-600/5" sub={`${totalSent > 0 ? Math.round((totalFailed / totalSent) * 100) : 0}%`} />
      </div>

      {/* 14-Day Chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" />14-Day Trend</h3>
        <div className="flex items-end gap-1.5 h-[160px]">
          {daily.map((d, i) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group">
              <div className="w-full flex flex-col items-center gap-0.5 flex-1 justify-end relative">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-border rounded-lg px-2 py-1 text-[9px] whitespace-nowrap shadow-lg z-10">
                  {d.sent}s / {d.delivered}d / {d.read}r / {d.failed}f
                </div>
                {d.read > 0 && <motion.div initial={{ height: 0 }} animate={{ height: `${(d.read / maxSent) * 100}%` }} transition={{ delay: i * 0.03 }} className="w-full max-w-[24px] bg-emerald-400/50 rounded-t min-h-[2px]" />}
                {d.delivered > 0 && <motion.div initial={{ height: 0 }} animate={{ height: `${(d.delivered / maxSent) * 100}%` }} transition={{ delay: i * 0.03 + 0.05 }} className="w-full max-w-[24px] bg-green-500/40 rounded-t min-h-[2px]" />}
                <motion.div initial={{ height: 0 }} animate={{ height: `${(d.sent / maxSent) * 100}%` }} transition={{ delay: i * 0.03 + 0.1 }} className="w-full max-w-[24px] bg-green-500 rounded-t min-h-[2px]" />
              </div>
              <p className="text-[8px] text-muted-foreground">{format(new Date(d.date), "dd")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly Heatmap */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" />Peak Hours</h3>
          <div className="grid grid-cols-12 gap-1">
            {hourlyHeatmap.map((count, hour) => {
              const intensity = count / maxHour;
              return (
                <div key={hour} className="text-center group relative">
                  <div className={`h-8 rounded-md transition-all cursor-pointer ${intensity > 0.7 ? "bg-green-500" : intensity > 0.4 ? "bg-green-500/60" : intensity > 0.1 ? "bg-green-500/25" : "bg-secondary/50"}`} title={`${hour}:00 - ${count} messages`} />
                  <p className="text-[8px] text-muted-foreground mt-0.5">{hour}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 justify-center text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-secondary/50" />Low</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500/25" />Med</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500/60" />High</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500" />Peak</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" />Category Breakdown</h3>
          <div className="space-y-2.5">
            {topCategories.slice(0, 8).map((cat, i) => {
              const maxCat = topCategories[0]?.count || 1;
              const pct = Math.round((cat.count / maxCat) * 100);
              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-foreground capitalize">{cat.category.replace(/_/g, " ")}</span>
                    <span className="text-xs font-bold text-foreground">{cat.count}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: i * 0.05 }} className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delivery Performance */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><Gauge className="w-4 h-4 text-green-500" />Delivery Performance</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-xl bg-secondary/30">
            <p className="text-2xl font-black text-foreground">{totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0}%</p>
            <p className="text-[10px] text-muted-foreground">Delivery Rate</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/30">
            <p className="text-2xl font-black text-foreground">{totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0}%</p>
            <p className="text-[10px] text-muted-foreground">Read Rate</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/30">
            <p className="text-2xl font-black text-foreground">{responseTime.avg}s</p>
            <p className="text-[10px] text-muted-foreground">Avg Delivery Time</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/30">
            <p className="text-2xl font-black text-foreground">{responseTime.median}s</p>
            <p className="text-[10px] text-muted-foreground">Median Delivery</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Event Triggers Tab ───
const EventTriggersTab = () => {
  const [triggers, setTriggers] = useState([
    { id: "signup", name: "User Signup", desc: "Welcome message on registration", icon: UserPlus, enabled: true, category: "onboarding", schedule: "Instant", color: "text-blue-500" },
    { id: "first_study", name: "First Study Session", desc: "Celebrate first study completion", icon: BookOpen, enabled: true, category: "study", schedule: "Instant", color: "text-green-500" },
    { id: "streak_milestone", name: "Streak Milestone", desc: "Celebrate 7, 14, 30, 100 day streaks", icon: Flame, enabled: true, category: "engagement", schedule: "On achievement", color: "text-orange-500" },
    { id: "streak_at_risk", name: "Streak At Risk", desc: "Alert when streak might break", icon: AlertTriangle, enabled: true, category: "engagement", schedule: "Daily 8 PM", color: "text-yellow-500" },
    { id: "risk_digest", name: "Memory Risk Digest", desc: "Daily digest of at-risk topics", icon: Brain, enabled: true, category: "study", schedule: "Daily 8 AM", color: "text-purple-500" },
    { id: "study_reminder", name: "Study Reminder", desc: "Personalized study nudge", icon: Bell, enabled: true, category: "study", schedule: "Every 4 hours", color: "text-primary" },
    { id: "exam_result", name: "Exam Result", desc: "Score and improvement tips after exam", icon: Trophy, enabled: true, category: "exam", schedule: "Instant", color: "text-emerald-500" },
    { id: "exam_countdown", name: "Exam Countdown", desc: "Daily countdown before scheduled exam", icon: Clock, enabled: false, category: "exam", schedule: "Daily 7 AM", color: "text-cyan-500" },
    { id: "burnout_alert", name: "Burnout Detection", desc: "Alert when burnout patterns detected", icon: Heart, enabled: true, category: "wellness", schedule: "On detection", color: "text-red-500" },
    { id: "brain_update", name: "Brain Update Reminder", desc: "Nudge if no brain activity in 24h", icon: Brain, enabled: true, category: "engagement", schedule: "Daily 9 PM", color: "text-violet-500" },
    { id: "weekly_report", name: "Weekly Report", desc: "AI-generated weekly study summary", icon: BarChart3, enabled: false, category: "analytics", schedule: "Sunday 10 AM", color: "text-indigo-500" },
    { id: "payment_success", name: "Payment Success", desc: "Confirmation after subscription payment", icon: CreditCard, enabled: true, category: "billing", schedule: "Instant", color: "text-green-500" },
    { id: "payment_failure", name: "Payment Failed", desc: "Alert on failed payment attempt", icon: AlertTriangle, enabled: true, category: "billing", schedule: "Instant", color: "text-red-500" },
    { id: "subscription_expiry", name: "Subscription Expiring", desc: "Reminder before plan expires", icon: Clock, enabled: true, category: "billing", schedule: "3 days before", color: "text-amber-500" },
    { id: "inactivity_7d", name: "7-Day Inactivity", desc: "Win-back message after 7 days inactive", icon: TrendingDown, enabled: true, category: "engagement", schedule: "After 7d inactive", color: "text-orange-500" },
    { id: "inactivity_30d", name: "30-Day Inactivity", desc: "Last chance re-engagement message", icon: XCircle, enabled: false, category: "engagement", schedule: "After 30d inactive", color: "text-red-500" },
    { id: "topic_mastered", name: "Topic Mastered", desc: "Celebrate when a topic reaches 100%", icon: Star, enabled: true, category: "study", schedule: "On achievement", color: "text-yellow-500" },
    { id: "leaderboard_change", name: "Leaderboard Change", desc: "Alert on rank up/down", icon: TrendingUp, enabled: false, category: "social", schedule: "On change", color: "text-blue-500" },
    { id: "community_mention", name: "Community Mention", desc: "Notify when mentioned in community", icon: MessageSquare, enabled: false, category: "social", schedule: "Instant", color: "text-cyan-500" },
    { id: "ai_insight", name: "AI Brain Insight", desc: "Weekly AI-powered learning insight", icon: Sparkles, enabled: true, category: "analytics", schedule: "Wednesday 10 AM", color: "text-purple-500" },
  ]);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const categories = [...new Set(triggers.map(t => t.category))];

  const toggleTrigger = (id: string) => {
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const filteredTriggers = triggers.filter(t => categoryFilter === "all" || t.category === categoryFilter);
  const enabledCount = triggers.filter(t => t.enabled).length;

  return (
    <div className="space-y-4">
      <SectionHeader icon={Zap} title="Event-Driven WhatsApp Triggers" subtitle={`${enabledCount}/${triggers.length} triggers active — every user event covered`} />

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCategoryFilter("all")}
          className={`text-[10px] px-2.5 py-1.5 rounded-lg font-medium transition-all ${categoryFilter === "all" ? "bg-green-600/15 text-green-500 border border-green-500/30" : "bg-secondary/50 text-muted-foreground border border-transparent hover:border-border"}`}>
          All ({triggers.length})
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setCategoryFilter(cat)}
            className={`text-[10px] px-2.5 py-1.5 rounded-lg font-medium capitalize transition-all ${categoryFilter === cat ? "bg-green-600/15 text-green-500 border border-green-500/30" : "bg-secondary/50 text-muted-foreground border border-transparent hover:border-border"}`}>
            {cat} ({triggers.filter(t => t.category === cat).length})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredTriggers.map((trigger, i) => (
          <motion.div key={trigger.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${trigger.enabled ? "bg-card border-green-500/15" : "bg-card/50 border-border opacity-60"}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trigger.enabled ? "bg-green-500/10" : "bg-secondary"}`}>
              <trigger.icon className={`w-5 h-5 ${trigger.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-foreground">{trigger.name}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{trigger.category}</span>
              </div>
              <p className="text-xs text-muted-foreground">{trigger.desc}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{trigger.schedule}</p>
            </div>
            <button onClick={() => toggleTrigger(trigger.id)} className={`w-11 h-6 rounded-full relative transition-all ${trigger.enabled ? "bg-green-500" : "bg-secondary"}`}>
              <motion.div className="w-4 h-4 rounded-full bg-white absolute top-1 shadow-sm" animate={{ left: trigger.enabled ? 24 : 4 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── API & Costing Tab ───
const APICostingTab = () => {
  const [stats, setStats] = useState({ totalMessages: 0, thisMonthMessages: 0, estimatedCost: 0, avgPerDay: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [totalRes, monthRes] = await Promise.all([
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth),
      ]);
      const total = totalRes.count || 0;
      const month = monthRes.count || 0;
      const daysInMonth = new Date().getDate();
      setStats({
        totalMessages: total, thisMonthMessages: month,
        estimatedCost: Math.round(month * 0.0042 * 100) / 100, // Twilio sandbox pricing ~$0.0042/msg
        avgPerDay: Math.round((month / daysInMonth) * 10) / 10,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const costBreakdown = [
    { label: "Twilio WhatsApp API", rate: "$0.0042/msg", monthly: `$${(stats.thisMonthMessages * 0.0042).toFixed(2)}`, icon: MessageSquare, color: "text-green-500" },
    { label: "Twilio Phone Number", rate: "$1.00/month", monthly: "$1.00", icon: Phone, color: "text-blue-500" },
    { label: "Webhook Processing", rate: "Included", monthly: "$0.00", icon: Server, color: "text-purple-500" },
    { label: "Media Messages (est.)", rate: "$0.01/msg", monthly: `$${(stats.thisMonthMessages * 0.1 * 0.01).toFixed(2)}`, icon: Image, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader icon={DollarSign} title="WhatsApp API Costs & Usage" subtitle="Real-time Twilio cost monitoring and API health" />

      {/* Cost Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStatCard label="All Time Messages" value={stats.totalMessages} icon={Send} color="text-blue-500" border="border-blue-500/20" gradient="from-blue-500/20 to-blue-600/5" />
        <MiniStatCard label="This Month" value={stats.thisMonthMessages} icon={Calendar} color="text-green-500" border="border-green-500/20" gradient="from-green-500/20 to-green-600/5" />
        <MiniStatCard label="Avg/Day" value={stats.avgPerDay} icon={TrendingUp} color="text-primary" border="border-primary/20" gradient="from-primary/20 to-primary/5" />
        <div className="relative overflow-hidden rounded-xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/20 to-yellow-600/5 p-3">
          <DollarSign className="w-4 h-4 text-yellow-500 mb-2" />
          <p className="text-xl font-bold text-foreground">${stats.estimatedCost.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">Est. Monthly Cost</p>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-green-500" />Cost Breakdown</h3>
        <div className="space-y-3">
          {costBreakdown.map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.rate}</p>
              </div>
              <p className="text-sm font-bold text-foreground">{item.monthly}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
          <p className="text-sm font-bold text-foreground">Estimated Total</p>
          <p className="text-lg font-black text-green-500">${(stats.estimatedCost + 1 + stats.thisMonthMessages * 0.1 * 0.01).toFixed(2)}/mo</p>
        </div>
      </div>

      {/* API Health */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><Server className="w-4 h-4 text-primary" />API Health & Limits</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1"><Wifi className="w-4 h-4 text-green-500" /><p className="text-xs font-bold text-green-500">API Status</p></div>
            <p className="text-lg font-black text-foreground">Operational</p>
            <p className="text-[10px] text-muted-foreground">Twilio WhatsApp API</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1"><Gauge className="w-4 h-4 text-blue-500" /><p className="text-xs font-bold text-blue-500">Rate Limit</p></div>
            <p className="text-lg font-black text-foreground">1 msg/sec</p>
            <p className="text-[10px] text-muted-foreground">Sandbox limit</p>
          </div>
          <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-yellow-500" /><p className="text-xs font-bold text-yellow-500">Environment</p></div>
            <p className="text-lg font-black text-foreground">Sandbox</p>
            <p className="text-[10px] text-muted-foreground">Opt-in required</p>
          </div>
        </div>
      </div>

      <ConnectionHealthPanel />
    </div>
  );
};

// ─── Settings Tab ───
const SettingsTab = () => (
  <div className="space-y-4">
    <ConnectionHealthPanel />
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Settings className="w-4 h-4 text-muted-foreground" />Twilio Configuration</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-secondary/50 rounded-xl p-3"><p className="text-[10px] text-muted-foreground">WhatsApp Number</p><p className="text-sm font-mono font-bold text-foreground mt-0.5">+14155238886</p></div>
        <div className="bg-secondary/50 rounded-xl p-3"><p className="text-[10px] text-muted-foreground">Environment</p><p className="text-sm font-bold text-yellow-500 mt-0.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sandbox</p></div>
        <div className="bg-secondary/50 rounded-xl p-3"><p className="text-[10px] text-muted-foreground">Provider</p><p className="text-sm font-bold text-foreground mt-0.5">Twilio</p></div>
      </div>
    </div>
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-yellow-500">Sandbox Mode</p>
          <p className="text-xs text-muted-foreground mt-1">Recipients must first send <span className="font-mono text-foreground bg-secondary px-1 py-0.5 rounded">"join &lt;keyword&gt;"</span> to <span className="font-mono text-foreground">+14155238886</span> to opt-in.</p>
          <p className="text-xs text-muted-foreground mt-2">Upgrade to <span className="text-green-500 font-semibold">Twilio WhatsApp Business Profile</span> for unrestricted messaging.</p>
        </div>
      </div>
    </div>
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-green-500" />Webhook Configuration</h3>
      <div className="bg-secondary/50 rounded-xl p-3">
        <p className="text-[10px] text-muted-foreground mb-1">Status Callback URL</p>
        <div className="flex items-center gap-2">
          <code className="text-[11px] text-foreground font-mono flex-1 truncate">{`https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/whatsapp-webhook`}</code>
          <button onClick={() => navigator.clipboard.writeText("https://yvxrsujwgmzdjzsjyqfb.supabase.co/functions/v1/whatsapp-webhook")} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main Component ───
const WhatsAppManagement = () => {
  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-600/20 via-emerald-600/10 to-transparent border border-green-500/20 p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-600/30">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Ultra WhatsApp Command Center</h2>
            <p className="text-sm text-muted-foreground">Lead CRM • Campaigns • Analytics • Event Triggers • API Costs • Full Automation</p>
          </div>
        </div>
      </div>

      <QuickStatsHero />

      <Tabs defaultValue="send" className="space-y-4">
        <TabsList className="bg-secondary/50 border border-border p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="send" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <Send className="w-3.5 h-3.5" />Send
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <Clock className="w-3.5 h-3.5" />History
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <FileText className="w-3.5 h-3.5" />Templates
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <Users className="w-3.5 h-3.5" />Leads
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <Megaphone className="w-3.5 h-3.5" />Campaigns
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <BarChart3 className="w-3.5 h-3.5" />Analytics
          </TabsTrigger>
          <TabsTrigger value="events" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <Zap className="w-3.5 h-3.5" />Events
          </TabsTrigger>
          <TabsTrigger value="costs" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <DollarSign className="w-3.5 h-3.5" />Costs
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs rounded-lg data-[state=active]:bg-green-600/15 data-[state=active]:text-green-500 gap-1.5 py-2">
            <Settings className="w-3.5 h-3.5" />Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send"><SendMessageTab /></TabsContent>
        <TabsContent value="history"><MessageHistoryTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="leads"><LeadManagementTab /></TabsContent>
        <TabsContent value="campaigns"><CampaignManagementTab /></TabsContent>
        <TabsContent value="analytics"><AdvancedAnalyticsTab /></TabsContent>
        <TabsContent value="events"><EventTriggersTab /></TabsContent>
        <TabsContent value="costs"><APICostingTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppManagement;
