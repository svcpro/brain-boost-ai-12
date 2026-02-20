import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Rocket, Mail, Download, Trash2, ToggleLeft, ToggleRight,
  Calendar, Clock, Eye, RefreshCw, CheckCircle2, Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ComingSoonControlPanel = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: cfg }, { data: mails }] = await Promise.all([
      supabase.from("coming_soon_config").select("*").limit(1).maybeSingle(),
      supabase.from("coming_soon_emails").select("*").order("created_at", { ascending: false }),
    ]);
    if (cfg) setConfig(cfg);
    setEmails(mails || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const updateConfig = async (updates: Record<string, any>) => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("coming_soon_config")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", config.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setConfig((c: any) => ({ ...c, ...updates }));
      toast({ title: "✓ Updated", description: "Coming Soon settings saved." });
    }
  };

  const exportCSV = () => {
    const csv = "Email,Signed Up At\n" + emails.map(e => `${e.email},${e.created_at}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coming-soon-emails-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteEmail = async (id: string) => {
    await supabase.from("coming_soon_emails").delete().eq("id", id);
    setEmails((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Email removed" });
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const Toggle = ({ value, onToggle, label }: { value: boolean; onToggle: () => void; label: string }) => (
    <button onClick={onToggle} className="flex items-center gap-3 w-full py-3 px-4 rounded-xl bg-secondary/40 hover:bg-secondary/60 border border-border/30 transition-colors">
      {value ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
      <span className="text-sm font-medium text-foreground flex-1 text-left">{label}</span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${value ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
          <Rocket className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Coming Soon Control Panel</h2>
          <p className="text-xs text-muted-foreground">Manage launch page, countdown & email capture</p>
        </div>
        {saving && <RefreshCw className="w-4 h-4 animate-spin text-primary ml-auto" />}
      </div>

      {/* Status card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 border ${config.is_enabled ? "bg-primary/5 border-primary/20" : "bg-secondary/30 border-border/30"}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${config.is_enabled ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
          <h3 className="text-sm font-bold text-foreground">
            Coming Soon Mode: {config.is_enabled ? "ACTIVE" : "INACTIVE"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {config.is_enabled
            ? "All traffic is being redirected to the Coming Soon page."
            : "Landing page is showing normally. Enable to activate Coming Soon mode."}
        </p>
        <Toggle
          value={config.is_enabled}
          onToggle={() => updateConfig({ is_enabled: !config.is_enabled })}
          label="Enable Coming Soon Mode"
        />
      </motion.div>

      {/* Settings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Toggles */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Toggles</h4>
          <Toggle
            value={config.countdown_enabled}
            onToggle={() => updateConfig({ countdown_enabled: !config.countdown_enabled })}
            label="Show Countdown Timer"
          />
          <Toggle
            value={config.email_capture_enabled}
            onToggle={() => updateConfig({ email_capture_enabled: !config.email_capture_enabled })}
            label="Email Capture Form"
          />
          <Toggle
            value={config.auto_redirect_on_launch}
            onToggle={() => updateConfig({ auto_redirect_on_launch: !config.auto_redirect_on_launch })}
            label="Auto Redirect on Launch"
          />
        </div>

        {/* Text & Date */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</h4>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Hero Text</label>
            <input
              type="text"
              value={config.hero_text || ""}
              onChange={(e) => setConfig((c: any) => ({ ...c, hero_text: e.target.value }))}
              onBlur={() => updateConfig({ hero_text: config.hero_text })}
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary/60 border border-border/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Sub Text</label>
            <input
              type="text"
              value={config.sub_text || ""}
              onChange={(e) => setConfig((c: any) => ({ ...c, sub_text: e.target.value }))}
              onBlur={() => updateConfig({ sub_text: config.sub_text })}
              maxLength={200}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary/60 border border-border/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Launch Date
            </label>
            <input
              type="datetime-local"
              value={config.launch_date ? new Date(config.launch_date).toISOString().slice(0, 16) : ""}
              onChange={(e) => {
                const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                setConfig((c: any) => ({ ...c, launch_date: val }));
                updateConfig({ launch_date: val });
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-secondary/60 border border-border/40 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
      </div>

      {/* Email list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">Collected Emails</h4>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{emails.length}</span>
          </div>
          {emails.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 border border-primary/20 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>

        {emails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No emails collected yet.
          </div>
        ) : (
          <div className="rounded-xl border border-border/30 overflow-hidden max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {emails.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{e.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(e.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-2">
                      <button
                        onClick={() => deleteEmail(e.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComingSoonControlPanel;
