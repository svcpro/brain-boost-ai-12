import { useState, useEffect, useCallback } from "react";
import { Facebook, Save, Loader2, CheckCircle2, XCircle, RefreshCw, Send, Activity, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Config = {
  id?: string;
  pixel_id: string | null;
  test_event_code: string | null;
  enabled: boolean;
  send_from_client: boolean;
  default_currency: string;
  notes: string | null;
};

type EventRow = {
  id: string;
  event_name: string;
  event_id: string | null;
  status: string;
  http_status: number | null;
  fb_trace_id: string | null;
  error: string | null;
  created_at: string;
  event_source_url: string | null;
};

const DEFAULT_CFG: Config = {
  pixel_id: "",
  test_event_code: "",
  enabled: false,
  send_from_client: false,
  default_currency: "INR",
  notes: "",
};

const MetaCapiManagement = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Config>(DEFAULT_CFG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [showToken, setShowToken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from("meta_capi_config").select("*").limit(1).maybeSingle(),
      supabase.from("meta_capi_events").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (c) setCfg(c as Config);
    setEvents((e || []) as EventRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const payload = {
      pixel_id: cfg.pixel_id?.trim() || null,
      test_event_code: cfg.test_event_code?.trim() || null,
      enabled: cfg.enabled,
      send_from_client: cfg.send_from_client,
      default_currency: cfg.default_currency || "INR",
      notes: cfg.notes,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
    };
    const { error } = cfg.id
      ? await supabase.from("meta_capi_config").update(payload).eq("id", cfg.id)
      : await supabase.from("meta_capi_config").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Meta CAPI configuration updated." });
      load();
    }
  };

  const sendTestEvent = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("meta-capi-track", {
      body: {
        event_name: "TestEvent",
        event_source_url: "https://acry.ai/admin",
        custom_data: { test: true, value: 0 },
      },
    });
    setTesting(false);
    if (error) {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    } else {
      const ok = (data as any)?.ok;
      toast({
        title: ok ? "Test event sent" : "Sent with issues",
        description: JSON.stringify((data as any)?.response || data).slice(0, 200),
        variant: ok ? "default" : "destructive",
      });
      load();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Facebook className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Meta Conversion API</h2>
          <p className="text-xs text-muted-foreground">Server-side Facebook Pixel events for higher attribution accuracy</p>
        </div>
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Config card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Configuration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Pixel ID and test settings. Access token is stored securely in backend secrets.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-muted-foreground">{cfg.enabled ? "Enabled" : "Disabled"}</span>
            <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="sr-only peer" />
            <div className="w-10 h-5 bg-secondary rounded-full peer peer-checked:bg-primary relative transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-background after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Pixel ID</label>
            <input
              value={cfg.pixel_id || ""}
              onChange={(e) => setCfg({ ...cfg, pixel_id: e.target.value })}
              placeholder="e.g. 1234567890123456"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Test Event Code (optional)</label>
            <input
              value={cfg.test_event_code || ""}
              onChange={(e) => setCfg({ ...cfg, test_event_code: e.target.value })}
              placeholder="TEST12345"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Default Currency</label>
            <input
              value={cfg.default_currency || ""}
              onChange={(e) => setCfg({ ...cfg, default_currency: e.target.value.toUpperCase() })}
              placeholder="INR"
              maxLength={3}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Access Token</label>
            <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/30 text-sm text-muted-foreground">
              {showToken ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Eye className="w-4 h-4" />}
              <span className="flex-1 truncate">Stored as <code className="text-xs">META_CAPI_ACCESS_TOKEN</code> secret</span>
              <button onClick={() => setShowToken(!showToken)} className="text-xs text-primary hover:underline">
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={cfg.notes || ""}
            onChange={(e) => setCfg({ ...cfg, notes: e.target.value })}
            rows={2}
            placeholder="Internal notes…"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
          />
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
          <button onClick={sendTestEvent} disabled={testing || !cfg.enabled || !cfg.pixel_id} className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test Event
          </button>
        </div>
      </div>

      {/* Events log */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent Events</h3>
          <span className="ml-auto text-xs text-muted-foreground">{events.length} shown</span>
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No events sent yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/30 text-xs">
                {ev.status === "sent" ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{ev.event_name}</span>
                    {ev.http_status && <span className="text-muted-foreground">HTTP {ev.http_status}</span>}
                    {ev.fb_trace_id && <span className="text-muted-foreground truncate">trace: {ev.fb_trace_id}</span>}
                  </div>
                  {ev.error && <div className="text-destructive mt-0.5 truncate">{ev.error}</div>}
                  {ev.event_source_url && <div className="text-muted-foreground mt-0.5 truncate">{ev.event_source_url}</div>}
                </div>
                <span className="text-muted-foreground shrink-0">{new Date(ev.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-secondary/20 p-4 text-xs text-muted-foreground space-y-1">
        <p><strong className="text-foreground">How it works:</strong> Call <code>trackMetaEvent</code> from <code>@/lib/metaCapi</code> anywhere in the app. Events are POSTed server-side via the <code>meta-capi-track</code> edge function with PII automatically SHA-256 hashed.</p>
        <p>Standard events: <code>PageView</code>, <code>Lead</code>, <code>CompleteRegistration</code>, <code>Subscribe</code>, <code>Purchase</code>, <code>InitiateCheckout</code>.</p>
      </div>
    </div>
  );
};

export default MetaCapiManagement;
