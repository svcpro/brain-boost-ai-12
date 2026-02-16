import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Users, Clock, CheckCircle2, XCircle, Eye,
  RefreshCw, Loader2, Search, Filter, Phone, FileText, Image,
  BarChart3, Zap, AlertTriangle, ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";

// ─── Send Message Tab ───
const SendMessageTab = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"single" | "bulk" | "template">("single");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

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
    } else {
      setSelectedTemplate(null);
      setTemplateParams({});
    }
  }, [templateName, templates]);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const numbers = mode === "bulk"
        ? bulkNumbers.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean)
        : [phone.trim()];

      if (numbers.length === 0 || numbers[0] === "") {
        toast({ title: "Enter phone number(s)", variant: "destructive" });
        setSending(false);
        return;
      }

      const payload = numbers.map(num => ({
        to: num.startsWith("+") ? num : `+${num}`,
        message: mode === "template" ? undefined : message,
        template_name: mode === "template" ? templateName : undefined,
        template_params: mode === "template" ? templateParams : undefined,
        media_url: mediaUrl || undefined,
        category: "manual",
      }));

      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: payload.length === 1 ? payload[0] : payload,
      });

      if (error) throw error;

      toast({
        title: `✅ ${data.sent} sent, ${data.failed} failed`,
        description: data.failed > 0 ? "Check message history for details" : undefined,
      });

      setMessage("");
      setPhone("");
      setBulkNumbers("");
      setMediaUrl("");
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const previewText = selectedTemplate
    ? (() => {
        let text = selectedTemplate.body_template;
        const vars = (selectedTemplate.variables as string[]) || [];
        vars.forEach((v: string, i: number) => {
          text = text.replace(`{{${i + 1}}}`, templateParams[v] || `[${v}]`);
        });
        return text;
      })()
    : message;

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        {[
          { key: "single", label: "Single", icon: Phone },
          { key: "bulk", label: "Bulk", icon: Users },
          { key: "template", label: "Template", icon: FileText },
        ].map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.key ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <m.icon className="w-4 h-4" />
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input */}
        <div className="space-y-3">
          {mode === "bulk" ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone Numbers (one per line)</label>
              <textarea
                value={bulkNumbers}
                onChange={e => setBulkNumbers(e.target.value)}
                placeholder={"+919876543210\n+919876543211"}
                className="w-full mt-1 p-3 rounded-lg bg-secondary border border-border text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {bulkNumbers.split(/[\n,;]+/).filter(n => n.trim()).length} numbers
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+919876543210"
                className="w-full mt-1 p-3 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {mode === "template" ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <select
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="w-full mt-1 p-3 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.name}>{t.name} — {t.description}</option>
                  ))}
                </select>
              </div>
              {selectedTemplate && (selectedTemplate.variables as string[] || []).map((v: string) => (
                <div key={v}>
                  <label className="text-xs font-medium text-muted-foreground capitalize">{v.replace(/_/g, " ")}</label>
                  <input
                    value={templateParams[v] || ""}
                    onChange={e => setTemplateParams(p => ({ ...p, [v]: e.target.value }))}
                    placeholder={v}
                    className="w-full mt-1 p-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your WhatsApp message..."
                className="w-full mt-1 p-3 rounded-lg bg-secondary border border-border text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{message.length}/1600</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Media URL (optional)</label>
            <input
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full mt-1 p-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending…" : mode === "bulk" ? "Send to All" : "Send WhatsApp"}
          </button>
        </div>

        {/* Preview */}
        <div className="bg-[#0b141a] rounded-2xl p-4 min-h-[300px]">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/10">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">ACRY Brain</p>
              <p className="text-white/50 text-[10px]">WhatsApp Preview</p>
            </div>
          </div>
          {previewText ? (
            <div className="bg-[#005c4b] rounded-lg rounded-tl-none p-3 max-w-[85%] ml-auto">
              <p className="text-white text-xs whitespace-pre-wrap leading-relaxed">{previewText}</p>
              <p className="text-white/50 text-[9px] text-right mt-1">
                {format(new Date(), "h:mm a")} ✓✓
              </p>
            </div>
          ) : (
            <p className="text-white/30 text-xs text-center mt-12">Message preview will appear here</p>
          )}
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
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);

    const { data } = await query;
    setMessages(data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const filtered = messages.filter(m =>
    !search || m.to_number?.includes(search) || m.content?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    queued: "bg-yellow-500/15 text-yellow-600",
    sent: "bg-blue-500/15 text-blue-500",
    delivered: "bg-green-500/15 text-green-600",
    read: "bg-emerald-500/15 text-emerald-600",
    failed: "bg-destructive/15 text-destructive",
    undelivered: "bg-orange-500/15 text-orange-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search number or content..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="delivered">Delivered</option>
          <option value="read">Read</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
        </select>
        <button onClick={fetchMessages} className="p-2 rounded-lg bg-secondary border border-border hover:bg-secondary/80">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No messages found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => (
            <motion.div
              key={msg.id}
              layout
              className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
              onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-600/15 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{msg.to_number}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[msg.status] || "bg-secondary text-muted-foreground"}`}>
                      {msg.status}
                    </span>
                    {msg.category && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {msg.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.content?.slice(0, 80)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                  <ChevronDown className={`w-3 h-3 text-muted-foreground mt-1 ml-auto transition-transform ${expanded === msg.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              <AnimatePresence>
                {expanded === msg.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{msg.message_type}</span></div>
                        <div><span className="text-muted-foreground">SID:</span> <span className="text-foreground font-mono text-[10px]">{msg.twilio_sid || "—"}</span></div>
                        {msg.delivered_at && <div><span className="text-muted-foreground">Delivered:</span> <span className="text-foreground">{format(new Date(msg.delivered_at), "PPp")}</span></div>}
                        {msg.read_at && <div><span className="text-muted-foreground">Read:</span> <span className="text-foreground">{format(new Date(msg.read_at), "PPp")}</span></div>}
                        {msg.error_message && <div className="col-span-2"><span className="text-destructive">Error: {msg.error_code} — {msg.error_message}</span></div>}
                      </div>
                      {msg.content && (
                        <div className="bg-secondary rounded-lg p-2 whitespace-pre-wrap text-foreground">{msg.content}</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Analytics Tab ───
const AnalyticsTab = () => {
  const [stats, setStats] = useState({ total: 0, delivered: 0, read: 0, failed: 0, today: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const [totalRes, deliveredRes, readRes, failedRes, todayRes] = await Promise.all([
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "delivered"),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "read"),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).eq("status", "failed"),
        (supabase as any).from("whatsapp_messages").select("id", { count: "exact", head: true }).gte("created_at", today),
      ]);
      setStats({
        total: totalRes.count || 0,
        delivered: deliveredRes.count || 0,
        read: readRes.count || 0,
        failed: failedRes.count || 0,
        today: todayRes.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Total Sent", value: stats.total, icon: Send, color: "text-blue-500" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "text-green-500" },
    { label: "Read", value: stats.read, icon: Eye, color: "text-emerald-500" },
    { label: "Failed", value: stats.failed, icon: XCircle, color: "text-destructive" },
    { label: "Today", value: stats.today, icon: Clock, color: "text-primary" },
  ];

  const deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const readRate = stats.delivered > 0 ? Math.round((stats.read / stats.delivered) * 100) : 0;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <c.icon className={`w-5 h-5 mx-auto mb-1 ${c.color}`} />
            <p className="text-xl font-bold text-foreground">{c.value}</p>
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Delivery Rate</p>
          <p className="text-2xl font-bold text-foreground">{deliveryRate}%</p>
          <div className="w-full h-2 bg-secondary rounded-full mt-2">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${deliveryRate}%` }} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Read Rate</p>
          <p className="text-2xl font-bold text-foreground">{readRate}%</p>
          <div className="w-full h-2 bg-secondary rounded-full mt-2">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${readRate}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Templates Tab ───
const TemplatesTab = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      {templates.map(t => (
        <div key={t.id} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{t.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t.category}</span>
            </div>
            <button
              onClick={() => toggleTemplate(t.id, t.is_active)}
              className={`w-10 h-6 rounded-full transition-all relative ${t.is_active ? "bg-green-500" : "bg-secondary"}`}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-white absolute top-1"
                animate={{ left: t.is_active ? 22 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
          <div className="bg-secondary rounded-lg p-3 text-xs text-foreground whitespace-pre-wrap font-mono">
            {t.body_template}
          </div>
          {t.variables?.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {(t.variables as string[]).map((v: string) => (
                <span key={v} className="text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent font-medium">{v}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───
const WhatsAppManagement = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-600/15 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">WhatsApp Notifications</h2>
          <p className="text-xs text-muted-foreground">Send and manage WhatsApp messages via Twilio</p>
        </div>
      </div>

      <Tabs defaultValue="send" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="send" className="text-xs"><Send className="w-3 h-3 mr-1" />Send</TabsTrigger>
          <TabsTrigger value="history" className="text-xs"><Clock className="w-3 h-3 mr-1" />History</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs"><FileText className="w-3 h-3 mr-1" />Templates</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs"><BarChart3 className="w-3 h-3 mr-1" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="send"><SendMessageTab /></TabsContent>
        <TabsContent value="history"><MessageHistoryTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppManagement;
