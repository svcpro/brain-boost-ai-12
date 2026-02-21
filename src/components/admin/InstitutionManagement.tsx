import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Users, GraduationCap, Plus, Search, ToggleLeft, ToggleRight,
  Loader2, Eye, Globe, Palette, CreditCard, TrendingUp, CheckCircle2,
  Clock, AlertTriangle, IndianRupee, BarChart3, Shield, Zap, ArrowRight,
  ChevronDown, ChevronRight, Activity, Layers, Settings, FileText, X,
  Webhook, BookOpen, Fingerprint, Crown, Sparkles, Server, Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import BatchManagement from "./institution/BatchManagement";
import FacultyDashboard from "./institution/FacultyDashboard";
import LicenseBilling from "./institution/LicenseBilling";
import BrandingConfig from "./institution/BrandingConfig";
import FeatureToggles from "./institution/FeatureToggles";
import ContractManagement from "./institution/ContractManagement";
import DomainManagement from "./institution/DomainManagement";
import InstitutionAuditLog from "./institution/InstitutionAuditLog";

interface Institution {
  id: string;
  name: string;
  slug: string;
  type: string;
  logo_url: string | null;
  primary_color: string;
  domain: string | null;
  is_active: boolean;
  student_count: number;
  teacher_count: number;
  created_at: string;
  city: string | null;
  branch: string | null;
  license_status: string | null;
  max_students: number | null;
}

type DashboardView = "overview" | "institution-detail";
type DetailTab = "batches" | "faculty" | "branding" | "features" | "domains" | "contracts" | "billing" | "audit";

const TYPE_CONFIG: Record<string, { color: string; bg: string; gradient: string; icon: any }> = {
  coaching: { color: "text-primary", bg: "bg-primary/15", gradient: "from-primary/20 to-primary/5", icon: BookOpen },
  school: { color: "text-emerald-400", bg: "bg-emerald-500/15", gradient: "from-emerald-500/20 to-emerald-500/5", icon: GraduationCap },
  university: { color: "text-accent", bg: "bg-accent/15", gradient: "from-accent/20 to-accent/5", icon: Crown },
  enterprise: { color: "text-amber-400", bg: "bg-amber-500/15", gradient: "from-amber-500/20 to-amber-500/5", icon: Building2 },
};

const DETAIL_TABS: { key: DetailTab; label: string; icon: any; color: string }[] = [
  { key: "batches", label: "Batches", icon: Layers, color: "text-primary" },
  { key: "faculty", label: "Faculty", icon: Users, color: "text-blue-400" },
  { key: "branding", label: "Branding", icon: Palette, color: "text-pink-400" },
  { key: "features", label: "Features", icon: Settings, color: "text-amber-400" },
  { key: "domains", label: "Domains", icon: Globe, color: "text-emerald-400" },
  { key: "contracts", label: "Contracts", icon: FileText, color: "text-violet-400" },
  { key: "billing", label: "Billing", icon: CreditCard, color: "text-success" },
  { key: "audit", label: "Audit Log", icon: Fingerprint, color: "text-red-400" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }),
};

export default function InstitutionManagement() {
  const { toast } = useToast();
  const [view, setView] = useState<DashboardView>("overview");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("coaching");
  const [newCity, setNewCity] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("batches");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: instData }, { data: licData }, { data: invData }, { data: whData }] = await Promise.all([
      supabase.from("institutions").select("*").order("created_at", { ascending: false }),
      supabase.from("institution_licenses").select("*"),
      supabase.from("institution_invoices").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("webhook_endpoints").select("*").order("created_at", { ascending: false }),
    ]);
    setInstitutions((instData as any[]) || []);
    setLicenses((licData as any[]) || []);
    setInvoices((invData as any[]) || []);
    setWebhooks((whData as any[]) || []);
    setLoading(false);
  };

  const createInstitution = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const { error } = await supabase.from("institutions").insert({
      name: newName.trim(), slug, type: newType, city: newCity || null, admin_user_id: user.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Institution created ✅" });
      setNewName(""); setNewCity(""); setShowCreate(false);
      loadAll();
    }
    setCreating(false);
  };

  const toggleActive = async (inst: Institution) => {
    await supabase.from("institutions").update({ is_active: !inst.is_active }).eq("id", inst.id);
    loadAll();
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const deleteInstitution = async (inst: Institution) => {
    setDeletingId(inst.id);
    // Delete related data first
    await Promise.all([
      supabase.from("batch_students").delete().in(
        "batch_id",
        (await supabase.from("institution_batches").select("id").eq("institution_id", inst.id)).data?.map(b => b.id) || []
      ),
      supabase.from("institution_batches").delete().eq("institution_id", inst.id),
      supabase.from("batch_analytics").delete().eq("institution_id", inst.id),
      supabase.from("institution_licenses").delete().eq("institution_id", inst.id),
      supabase.from("institution_invoices").delete().eq("institution_id", inst.id),
    ]);
    const { error } = await supabase.from("institutions").delete().eq("id", inst.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Institution deleted 🗑️" });
      if (selectedInst?.id === inst.id) setView("overview");
      loadAll();
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const openInstitution = (inst: Institution) => {
    setSelectedInst(inst);
    setDetailTab("batches");
    setView("institution-detail");
  };

  // Computed stats
  const totalStudents = institutions.reduce((s, i) => s + (i.student_count || 0), 0);
  const totalTeachers = institutions.reduce((s, i) => s + (i.teacher_count || 0), 0);
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0);
  const pendingRevenue = invoices.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.amount || 0), 0);
  const activeLicenses = licenses.filter(l => l.status === "active").length;
  const activeInstitutions = institutions.filter(i => i.is_active).length;
  const expiringLicenses = licenses.filter(l => {
    if (!l.expires_at || l.status !== "active") return false;
    const diff = new Date(l.expires_at).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  });
  const activeWebhooks = webhooks.filter(w => w.is_active).length;

  const filtered = useMemo(() => institutions.filter(i =>
    (typeFilter === "all" || i.type === typeFilter) &&
    (i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.slug.toLowerCase().includes(search.toLowerCase()) ||
    (i.city || "").toLowerCase().includes(search.toLowerCase()))
  ), [institutions, search, typeFilter]);

  const typeDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    institutions.forEach(i => { dist[i.type] = (dist[i.type] || 0) + 1; });
    return dist;
  }, [institutions]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div className="absolute -inset-2 rounded-3xl bg-primary/5 animate-ping" />
        </div>
        <p className="text-sm text-muted-foreground">Loading institution data...</p>
      </div>
    );
  }

  // ─── INSTITUTION DETAIL VIEW ───
  if (view === "institution-detail" && selectedInst) {
    const cfg = TYPE_CONFIG[selectedInst.type] || TYPE_CONFIG.coaching;
    const instLicense = licenses.find(l => l.institution_id === selectedInst.id && l.status === "active");
    return (
      <div className="space-y-5">
        {/* Back + Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <button onClick={() => setView("overview")} className="p-2 rounded-xl hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br", cfg.gradient)}>
            <cfg.icon className={cn("w-6 h-6", cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground truncate">{selectedInst.name}</h2>
              <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-md capitalize", cfg.bg, cfg.color)}>{selectedInst.type}</span>
              {selectedInst.is_active ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-success/15 text-success">Active</span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-destructive/15 text-destructive">Inactive</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
              {selectedInst.city && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{selectedInst.city}</span>}
              <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{selectedInst.student_count || 0} students</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedInst.teacher_count || 0} faculty</span>
              {instLicense && <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-success" />{instLicense.plan_name}</span>}
            </div>
          </div>
          {/* Delete in detail view */}
          {confirmDeleteId === selectedInst.id ? (
            <div className="flex items-center gap-1.5 ml-auto">
              <button onClick={() => deleteInstitution(selectedInst)} disabled={deletingId === selectedInst.id}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {deletingId === selectedInst.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete permanently
              </button>
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDeleteId(selectedInst.id)}
              className="ml-auto p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete institution">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </motion.div>

        {/* Detail Tab Navigation */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin"
        >
          {DETAIL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setDetailTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0",
                detailTab === t.key
                  ? "bg-card border border-border shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <t.icon className={cn("w-3.5 h-3.5", detailTab === t.key ? t.color : "")} />
              {t.label}
            </button>
          ))}
        </motion.div>

        {/* Detail Content */}
        <AnimatePresence mode="wait">
          <motion.div key={detailTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
            {detailTab === "batches" && <BatchManagement institutionId={selectedInst.id} institutionName={selectedInst.name} />}
            {detailTab === "faculty" && <FacultyDashboard institutionId={selectedInst.id} />}
            {detailTab === "branding" && <BrandingConfig institutionId={selectedInst.id} institutionName={selectedInst.name} />}
            {detailTab === "features" && <FeatureToggles institutionId={selectedInst.id} institutionName={selectedInst.name} />}
            {detailTab === "domains" && <DomainManagement institutionId={selectedInst.id} institutionName={selectedInst.name} />}
            {detailTab === "contracts" && <ContractManagement institutionId={selectedInst.id} institutionName={selectedInst.name} />}
            {detailTab === "billing" && <LicenseBilling institutionId={selectedInst.id} institutionName={selectedInst.name} />}
            {detailTab === "audit" && <InstitutionAuditLog institutionId={selectedInst.id} institutionName={selectedInst.name} />}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ─── OVERVIEW DASHBOARD ───
  return (
    <div className="space-y-6">
      {/* ─── HERO HEADER ─── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)" }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-accent/5 blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Building2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Institution Hub</h1>
              <p className="text-xs text-muted-foreground mt-0.5">White-Label SaaS • Multi-Tenant Platform • Enterprise Control</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" /> New Institution
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── CREATE MODAL ─── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl p-5 bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Create New Institution
                </h3>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Institution name *"
                  className="w-full bg-secondary/40 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="City (optional)"
                  className="w-full bg-secondary/40 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["coaching", "school", "university", "enterprise"] as const).map(t => {
                  const cfg = TYPE_CONFIG[t];
                  return (
                    <button key={t} onClick={() => setNewType(t)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all",
                        newType === t ? `bg-gradient-to-r ${cfg.gradient} ${cfg.color} border border-current/20` : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                      )}>
                      <cfg.icon className="w-3.5 h-3.5" /> {t}
                    </button>
                  );
                })}
              </div>
              <button onClick={createInstitution} disabled={creating || !newName.trim()}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Institution"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── KPI CARDS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Institutions", value: institutions.length, sub: `${activeInstitutions} active`, icon: Building2, color: "text-primary", gradient: "from-primary/15 to-primary/5", dot: "bg-primary" },
          { label: "Total Students", value: totalStudents.toLocaleString(), sub: `${totalTeachers} faculty`, icon: GraduationCap, color: "text-emerald-400", gradient: "from-emerald-500/15 to-emerald-500/5", dot: "bg-emerald-400" },
          { label: "Revenue", value: `₹${totalRevenue > 1000 ? `${(totalRevenue/1000).toFixed(1)}K` : totalRevenue}`, sub: `₹${pendingRevenue} pending`, icon: IndianRupee, color: "text-success", gradient: "from-success/15 to-success/5", dot: "bg-success" },
          { label: "Licenses", value: activeLicenses, sub: `${expiringLicenses.length} expiring`, icon: Shield, color: "text-accent", gradient: "from-accent/15 to-accent/5", dot: "bg-accent" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className={cn("relative overflow-hidden rounded-2xl p-4 border border-border/40 bg-gradient-to-br", kpi.gradient)}
          >
            <div className="absolute top-3 right-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-background/50 backdrop-blur-sm")}>
                <kpi.icon className={cn("w-4.5 h-4.5", kpi.color)} />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mb-3">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", kpi.dot)} />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className={cn("text-2xl font-extrabold tabular-nums", kpi.color)}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground/80 mt-1">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ─── EXPIRING LICENSE WARNING ─── */}
      <AnimatePresence>
        {expiringLicenses.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-4 border border-warning/30 bg-gradient-to-r from-warning/10 to-warning/5"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <span className="text-xs font-bold text-warning">{expiringLicenses.length} License(s) Expiring This Week</span>
            </div>
            <div className="space-y-1">
              {expiringLicenses.map(l => {
                const inst = institutions.find(i => i.id === l.institution_id);
                return (
                  <div key={l.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-foreground font-medium">{inst?.name || l.institution_id.slice(0, 8)}</span>
                    <span className="text-warning font-semibold">Expires {format(new Date(l.expires_at), "dd MMM")}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TYPE DISTRIBUTION + WEBHOOKS ROW ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Type Distribution */}
        <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible"
          className="rounded-2xl p-4 border border-border/40 bg-card/60"
        >
          <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Distribution by Type
          </h4>
          <div className="space-y-2.5">
            {Object.entries(typeDistribution).map(([type, count]) => {
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.coaching;
              const pct = institutions.length > 0 ? (count / institutions.length) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <cfg.icon className={cn("w-3.5 h-3.5", cfg.color)} />
                      <span className="text-[11px] font-medium text-foreground capitalize">{type}</span>
                    </div>
                    <span className={cn("text-[10px] font-bold", cfg.color)}>{count} ({Math.round(pct)}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      className={cn("h-full rounded-full bg-gradient-to-r", cfg.gradient)}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(typeDistribution).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No institutions yet</p>
            )}
          </div>
        </motion.div>

        {/* Webhooks Summary */}
        <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible"
          className="rounded-2xl p-4 border border-border/40 bg-card/60"
        >
          <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <Webhook className="w-4 h-4 text-accent" /> Webhook Endpoints
            <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-md bg-accent/15 text-accent">{activeWebhooks}/{webhooks.length}</span>
          </h4>
          {webhooks.length === 0 ? (
            <div className="text-center py-6">
              <Server className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No webhook endpoints configured</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin">
              {webhooks.slice(0, 5).map(wh => (
                <div key={wh.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-secondary/30">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", wh.is_active ? "bg-success animate-pulse" : "bg-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-foreground truncate">{wh.url}</p>
                    <span className="text-[9px] text-muted-foreground">{(wh.events || []).length} events</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1">
            {["session_completed", "score_changed", "topic_mastered", "streak_broken"].map(e => (
              <span key={e} className="px-1.5 py-0.5 rounded-md bg-secondary/50 text-[8px] font-mono text-muted-foreground">{e}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── RECENT REVENUE ─── */}
      {invoices.length > 0 && (
        <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible"
          className="rounded-2xl p-4 border border-border/40 bg-card/60"
        >
          <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-success" /> Revenue Overview
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {institutions.slice(0, 6).map(inst => {
              const instInvoices = invoices.filter(i => i.institution_id === inst.id && i.status === "paid");
              const instRevenue = instInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);
              const cfg = TYPE_CONFIG[inst.type] || TYPE_CONFIG.coaching;
              if (instRevenue === 0 && instInvoices.length === 0) return null;
              return (
                <div key={inst.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/20">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br", cfg.gradient)}>
                    <cfg.icon className={cn("w-4 h-4", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-foreground truncate block">{inst.name}</span>
                    <span className="text-[10px] text-muted-foreground">{instInvoices.length} paid invoices</span>
                  </div>
                  <span className="text-sm font-extrabold text-success tabular-nums">₹{instRevenue}</span>
                </div>
              );
            }).filter(Boolean)}
            {invoices.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 col-span-full">No invoices yet</p>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── SEARCH + FILTER BAR ─── */}
      <motion.div custom={7} variants={cardVariants} initial="hidden" animate="visible" className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search institutions..."
            className="w-full bg-secondary/30 border border-border/40 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter("all")}
            className={cn("px-3 py-2 rounded-xl text-[11px] font-medium transition-all", typeFilter === "all" ? "bg-primary/15 text-primary border border-primary/20" : "bg-secondary/30 text-muted-foreground hover:text-foreground")}>
            All ({institutions.length})
          </button>
          {Object.entries(typeDistribution).map(([type, count]) => {
            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.coaching;
            return (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={cn("flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-medium capitalize transition-all",
                  typeFilter === type ? `bg-gradient-to-r ${cfg.gradient} ${cfg.color} border border-current/15` : "bg-secondary/30 text-muted-foreground hover:text-foreground"
                )}>
                <cfg.icon className="w-3 h-3" /> {type} ({count})
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ─── INSTITUTION LIST ─── */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl p-12 border border-border/30 bg-card/40 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No institutions found</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          filtered.map((inst, i) => {
            const cfg = TYPE_CONFIG[inst.type] || TYPE_CONFIG.coaching;
            const instLicense = licenses.find(l => l.institution_id === inst.id && l.status === "active");
            const utilization = inst.max_students ? Math.round((inst.student_count / inst.max_students) * 100) : null;

            return (
              <motion.div
                key={inst.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.005 }}
                className={cn(
                  "group relative rounded-2xl p-4 border border-border/30 bg-card/60 hover:bg-card/80 transition-all duration-200 cursor-pointer",
                  "hover:border-border/60 hover:shadow-lg hover:shadow-primary/5"
                )}
                onClick={() => openInstitution(inst)}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br shrink-0 transition-transform group-hover:scale-105", cfg.gradient)}>
                    {inst.logo_url ? (
                      <img src={inst.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <cfg.icon className={cn("w-6 h-6", cfg.color)} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground truncate">{inst.name}</span>
                      <span className={cn("text-[8px] font-extrabold px-2 py-0.5 rounded-md capitalize", cfg.bg, cfg.color)}>{inst.type}</span>
                      {instLicense && <span className="text-[8px] font-bold px-2 py-0.5 rounded-md bg-success/15 text-success capitalize">{instLicense.plan_name}</span>}
                      {!inst.is_active && <span className="text-[8px] font-bold px-2 py-0.5 rounded-md bg-destructive/15 text-destructive">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><GraduationCap className="w-3 h-3" />{inst.student_count || 0} students</span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{inst.teacher_count || 0} faculty</span>
                      {inst.city && <span className="text-[10px] text-primary/80 flex items-center gap-1"><Globe className="w-3 h-3" />{inst.city}</span>}
                      {inst.domain && <span className="text-[10px] text-accent/80 flex items-center gap-1"><Globe className="w-3 h-3" />{inst.domain}</span>}
                    </div>
                  </div>

                  {/* Utilization + Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    {utilization !== null && (
                      <div className="hidden md:block text-center">
                        <div className="w-10 h-10 relative">
                          <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                            <circle cx="20" cy="20" r="16" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                            <circle cx="20" cy="20" r="16" fill="none"
                              stroke={utilization > 90 ? "hsl(var(--destructive))" : utilization > 70 ? "hsl(var(--warning))" : "hsl(var(--success))"}
                              strokeWidth="3" strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 16}
                              strokeDashoffset={2 * Math.PI * 16 * (1 - utilization / 100)}
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-extrabold text-foreground">{utilization}%</span>
                        </div>
                        <span className="text-[8px] text-muted-foreground mt-0.5">Capacity</span>
                      </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); toggleActive(inst); }}
                      className="p-2 rounded-xl hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
                      {inst.is_active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    {confirmDeleteId === inst.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => deleteInstitution(inst)} disabled={deletingId === inst.id}
                          className="px-2 py-1 rounded-lg text-[9px] font-bold bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-50">
                          {deletingId === inst.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-[9px] font-bold bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(inst.id); }}
                        className="p-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}