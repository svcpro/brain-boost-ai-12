import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Key, ExternalLink, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle2, Settings, DollarSign, Activity,
  Mail, Mic, CreditCard, Bell, Brain, Save, Pencil, Eye, EyeOff,
  Info, Hash, Plus, X, Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ApiIntegration {
  id: string;
  service_name: string;
  display_name: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  api_key_masked: string | null;
  key_last_updated_at: string | null;
  monthly_cost_estimate: number;
  monthly_usage_count: number;
  usage_limit: number | null;
  usage_reset_at: string | null;
  status: string;
  config: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  email: Mail,
  voice: Mic,
  payments: CreditCard,
  notifications: Bell,
  ai: Brain,
  general: Settings,
};

const CATEGORY_COLORS: Record<string, string> = {
  email: "text-primary",
  voice: "text-accent",
  payments: "text-warning",
  notifications: "text-success",
  ai: "text-primary",
  general: "text-muted-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/15 text-success",
  degraded: "bg-warning/15 text-warning",
  error: "bg-destructive/15 text-destructive",
  inactive: "bg-secondary text-muted-foreground",
};

const EMPTY_NEW_INTEGRATION = {
  service_name: "",
  display_name: "",
  description: "",
  category: "general",
  api_key_masked: "",
  monthly_cost_estimate: 0,
  usage_limit: null as number | null,
  notes: "",
  docs_url: "",
  pricing_url: "",
  secret_name: "",
  used_in: "",
};

const ApiManagement = () => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ApiIntegration>>({});
  const [filter, setFilter] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ ...EMPTY_NEW_INTEGRATION });
  const [saving, setSaving] = useState(false);

  const fetchIntegrations = useCallback(async () => {
    const { data } = await supabase
      .from("api_integrations")
      .select("*")
      .order("category, display_name");
    setIntegrations((data as ApiIntegration[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const toggleEnabled = async (id: string, current: boolean) => {
    await supabase.from("api_integrations").update({ is_enabled: !current } as any).eq("id", id);
    toast({ title: !current ? "Integration enabled" : "Integration disabled" });
    fetchIntegrations();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("api_integrations").update({ status } as any).eq("id", id);
    toast({ title: `Status updated to ${status}` });
    fetchIntegrations();
  };

  const startEdit = (integration: ApiIntegration) => {
    setEditingId(integration.id);
    setEditForm({
      monthly_cost_estimate: integration.monthly_cost_estimate,
      monthly_usage_count: integration.monthly_usage_count,
      usage_limit: integration.usage_limit,
      notes: integration.notes,
      api_key_masked: integration.api_key_masked,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase.from("api_integrations").update({
      monthly_cost_estimate: editForm.monthly_cost_estimate,
      monthly_usage_count: editForm.monthly_usage_count,
      usage_limit: editForm.usage_limit,
      notes: editForm.notes,
      api_key_masked: editForm.api_key_masked,
      key_last_updated_at: editForm.api_key_masked ? new Date().toISOString() : undefined,
    } as any).eq("id", editingId);
    toast({ title: "Integration updated" });
    setEditingId(null);
    fetchIntegrations();
  };

  const addIntegration = async () => {
    if (!newIntegration.service_name || !newIntegration.display_name) {
      toast({ title: "Service name and display name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const usedInArr = newIntegration.used_in.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("api_integrations").insert({
      service_name: newIntegration.service_name.toLowerCase().replace(/\s+/g, "_"),
      display_name: newIntegration.display_name,
      description: newIntegration.description || null,
      category: newIntegration.category,
      api_key_masked: newIntegration.api_key_masked || null,
      monthly_cost_estimate: newIntegration.monthly_cost_estimate || 0,
      usage_limit: newIntegration.usage_limit,
      notes: newIntegration.notes || null,
      config: {
        secret_name: newIntegration.secret_name || null,
        docs_url: newIntegration.docs_url || null,
        pricing_url: newIntegration.pricing_url || null,
        used_in: usedInArr,
        custom: true,
      },
      is_enabled: true,
      status: "active",
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to add integration", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Integration added successfully" });
    setNewIntegration({ ...EMPTY_NEW_INTEGRATION });
    setShowAddForm(false);
    fetchIntegrations();
  };

  const deleteIntegration = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await supabase.from("api_integrations").delete().eq("id", id);
    toast({ title: `"${name}" deleted` });
    fetchIntegrations();
  };

  const categories = ["all", ...Array.from(new Set(integrations.map(i => i.category)))];
  const filtered = filter === "all" ? integrations : integrations.filter(i => i.category === filter);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">API & Integrations</h2>
          <p className="text-xs text-muted-foreground mt-1">{integrations.length} services configured</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add Integration
        </button>
      </div>

      {/* Add New Integration Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="glass rounded-xl neural-border overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" /> New Custom Integration
                </h3>
                <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-secondary rounded-lg transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Display Name *</label>
                  <input
                    value={newIntegration.display_name}
                    onChange={e => setNewIntegration(p => ({ ...p, display_name: e.target.value }))}
                    placeholder="e.g. OpenAI GPT"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Service Name (unique key) *</label>
                  <input
                    value={newIntegration.service_name}
                    onChange={e => setNewIntegration(p => ({ ...p, service_name: e.target.value }))}
                    placeholder="e.g. openai_gpt"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Description</label>
                  <input
                    value={newIntegration.description}
                    onChange={e => setNewIntegration(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of this integration"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Category</label>
                  <select
                    value={newIntegration.category}
                    onChange={e => setNewIntegration(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                  >
                    <option value="ai">AI</option>
                    <option value="email">Email</option>
                    <option value="voice">Voice</option>
                    <option value="payments">Payments</option>
                    <option value="notifications">Notifications</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Secret Name (env var)</label>
                  <input
                    value={newIntegration.secret_name}
                    onChange={e => setNewIntegration(p => ({ ...p, secret_name: e.target.value }))}
                    placeholder="e.g. OPENAI_API_KEY"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Masked API Key (for display)</label>
                  <input
                    value={newIntegration.api_key_masked}
                    onChange={e => setNewIntegration(p => ({ ...p, api_key_masked: e.target.value }))}
                    placeholder="e.g. sk-****abcd"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Est. Monthly Cost ($)</label>
                  <input
                    type="number"
                    value={newIntegration.monthly_cost_estimate}
                    onChange={e => setNewIntegration(p => ({ ...p, monthly_cost_estimate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Usage Limit (optional)</label>
                  <input
                    type="number"
                    value={newIntegration.usage_limit ?? ""}
                    onChange={e => setNewIntegration(p => ({ ...p, usage_limit: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="No limit"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Docs URL</label>
                  <input
                    value={newIntegration.docs_url}
                    onChange={e => setNewIntegration(p => ({ ...p, docs_url: e.target.value }))}
                    placeholder="https://docs.example.com"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Pricing URL</label>
                  <input
                    value={newIntegration.pricing_url}
                    onChange={e => setNewIntegration(p => ({ ...p, pricing_url: e.target.value }))}
                    placeholder="https://example.com/pricing"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Used In (comma-separated edge function names)</label>
                  <input
                    value={newIntegration.used_in}
                    onChange={e => setNewIntegration(p => ({ ...p, used_in: e.target.value }))}
                    placeholder="e.g. my-function, another-function"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] text-muted-foreground mb-1 block">Notes</label>
                  <textarea
                    value={newIntegration.notes}
                    onChange={e => setNewIntegration(p => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    placeholder="Internal notes..."
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  onClick={addIntegration}
                  disabled={saving}
                  className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Integration
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-[10px] text-muted-foreground">Active</span>
          </div>
          <p className="text-xl font-bold text-foreground">{integrations.filter(i => i.is_enabled && i.status === "active").length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-[10px] text-muted-foreground">Issues</span>
          </div>
          <p className="text-xl font-bold text-foreground">{integrations.filter(i => i.status === "degraded" || i.status === "error").length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-muted-foreground">Est. Monthly Cost</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            ${integrations.reduce((s, i) => s + (i.monthly_cost_estimate || 0), 0).toFixed(0)}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-accent" />
            <span className="text-[10px] text-muted-foreground">Total API Calls</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {integrations.reduce((s, i) => s + (i.monthly_usage_count || 0), 0).toLocaleString()}
          </p>
        </motion.div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === cat ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Integration cards */}
      <div className="space-y-3">
        {filtered.map((integration, idx) => {
          const Icon = CATEGORY_ICONS[integration.category] || Settings;
          const colorClass = CATEGORY_COLORS[integration.category] || "text-muted-foreground";
          const isEditing = editingId === integration.id;
          const usedIn = (integration.config?.used_in as string[]) || [];
          const isManagedByConnector = integration.config?.managed_by_connector === true;
          const secretName = integration.config?.secret_name as string;
          const secretName2 = integration.config?.secret_name_2 as string;
          const docsUrl = integration.config?.docs_url as string;
          const pricingUrl = integration.config?.pricing_url as string;

          return (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="glass rounded-xl p-4 neural-border space-y-3"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{integration.display_name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLES[integration.status]}`}>
                      {integration.status}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                      {integration.category}
                    </span>
                    {isManagedByConnector && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">Connector</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!isEditing && (
                    <button onClick={() => startEdit(integration)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors" title="Edit">
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                  {(integration.config as any)?.custom && (
                    <button
                      onClick={() => deleteIntegration(integration.id, integration.display_name)}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleEnabled(integration.id, integration.is_enabled)}
                    className="p-1.5 hover:bg-secondary rounded-lg transition-colors"
                    title={integration.is_enabled ? "Disable" : "Enable"}
                  >
                    {integration.is_enabled ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              {/* Key & Usage Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Key className="w-3 h-3" /> Secret</span>
                  <p className="text-xs font-mono text-foreground">{secretName || "—"}</p>
                  {secretName2 && <p className="text-xs font-mono text-muted-foreground">{secretName2}</p>}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Est. Cost/mo</span>
                  <p className="text-xs font-medium text-foreground">${integration.monthly_cost_estimate || 0}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Activity className="w-3 h-3" /> Usage/mo</span>
                  <p className="text-xs font-medium text-foreground">
                    {(integration.monthly_usage_count || 0).toLocaleString()}
                    {integration.usage_limit ? ` / ${integration.usage_limit.toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Functions</span>
                  <p className="text-xs font-medium text-foreground">{usedIn.length} edge fn{usedIn.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {/* Used in functions */}
              {usedIn.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {usedIn.map((fn: string) => (
                    <span key={fn} className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">{fn}</span>
                  ))}
                </div>
              )}

              {/* Links */}
              <div className="flex items-center gap-3">
                {docsUrl && (
                  <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Docs
                  </a>
                )}
                {pricingUrl && (
                  <a href={pricingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-1 hover:underline">
                    <DollarSign className="w-3 h-3" /> Pricing
                  </a>
                )}
                {integration.key_last_updated_at && (
                  <span className="text-[10px] text-muted-foreground">
                    Key updated: {format(new Date(integration.key_last_updated_at), "MMM d, yyyy")}
                  </span>
                )}
              </div>

              {/* Notes */}
              {integration.notes && !isEditing && (
                <div className="bg-secondary/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5"><Info className="w-3 h-3" /> Notes</p>
                  <p className="text-xs text-foreground">{integration.notes}</p>
                </div>
              )}

              {/* Edit Form */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border pt-3 space-y-3 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Masked API Key (for display)</label>
                        <input
                          value={editForm.api_key_masked || ""}
                          onChange={e => setEditForm(p => ({ ...p, api_key_masked: e.target.value }))}
                          placeholder="e.g. sk-****abcd"
                          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Status</label>
                        <select
                          value={integration.status}
                          onChange={e => updateStatus(integration.id, e.target.value)}
                          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="degraded">Degraded</option>
                          <option value="error">Error</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Est. Monthly Cost ($)</label>
                        <input
                          type="number"
                          value={editForm.monthly_cost_estimate || 0}
                          onChange={e => setEditForm(p => ({ ...p, monthly_cost_estimate: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Usage This Month</label>
                        <input
                          type="number"
                          value={editForm.monthly_usage_count || 0}
                          onChange={e => setEditForm(p => ({ ...p, monthly_usage_count: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Usage Limit (optional)</label>
                        <input
                          type="number"
                          value={editForm.usage_limit || ""}
                          onChange={e => setEditForm(p => ({ ...p, usage_limit: e.target.value ? parseInt(e.target.value) : null }))}
                          placeholder="No limit"
                          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-muted-foreground mb-1 block">Notes</label>
                        <textarea
                          value={editForm.notes || ""}
                          onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                          rows={2}
                          placeholder="Internal notes about this integration..."
                          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                      <button onClick={saveEdit} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">
                        <Save className="w-3 h-3" /> Save
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No integrations in this category</p>
      )}
    </div>
  );
};

export default ApiManagement;
