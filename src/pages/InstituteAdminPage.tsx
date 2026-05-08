import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, GraduationCap, Layers, Palette, Settings, Globe,
  FileText, CreditCard, Fingerprint, Loader2, IndianRupee, Shield,
  TrendingUp, AlertTriangle, ChevronRight, LogOut, BookOpen, Crown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const BatchManagement = lazy(() => import("@/components/admin/institution/BatchManagement"));
const FacultyDashboard = lazy(() => import("@/components/admin/institution/FacultyDashboard"));
const BrandingConfig = lazy(() => import("@/components/admin/institution/BrandingConfig"));
const FeatureToggles = lazy(() => import("@/components/admin/institution/FeatureToggles"));
const DomainManagement = lazy(() => import("@/components/admin/institution/DomainManagement"));
const ContractManagement = lazy(() => import("@/components/admin/institution/ContractManagement"));
const LicenseBilling = lazy(() => import("@/components/admin/institution/LicenseBilling"));
const InstitutionAuditLog = lazy(() => import("@/components/admin/institution/InstitutionAuditLog"));

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
  city: string | null;
  branch: string | null;
  license_status: string | null;
  max_students: number | null;
  license_expires_at: string | null;
}

type Tab = "overview" | "batches" | "faculty" | "branding" | "features" | "domains" | "contracts" | "billing" | "audit";

const TABS: { key: Tab; label: string; icon: any; color: string }[] = [
  { key: "overview", label: "Overview", icon: TrendingUp, color: "text-primary" },
  { key: "batches", label: "Batches", icon: Layers, color: "text-primary" },
  { key: "faculty", label: "Faculty", icon: Users, color: "text-blue-400" },
  { key: "branding", label: "Branding", icon: Palette, color: "text-pink-400" },
  { key: "features", label: "Features", icon: Settings, color: "text-amber-400" },
  { key: "domains", label: "Domains", icon: Globe, color: "text-emerald-400" },
  { key: "contracts", label: "Contracts", icon: FileText, color: "text-violet-400" },
  { key: "billing", label: "Billing", icon: CreditCard, color: "text-success" },
  { key: "audit", label: "Audit", icon: Fingerprint, color: "text-red-400" },
];

const TYPE_ICON: Record<string, any> = {
  coaching: BookOpen, school: GraduationCap, university: Crown, enterprise: Building2,
};

const Loader = () => (
  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
);

export default function InstituteAdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [license, setLicense] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    loadInstitute();
  }, [user]);

  const loadInstitute = async () => {
    if (!user) return;
    setLoading(true);
    // Resolve institution where current user is the admin
    const { data: inst } = await supabase
      .from("institutions")
      .select("*")
      .eq("admin_user_id", user.id)
      .maybeSingle();

    if (!inst) {
      setInstitution(null);
      setLoading(false);
      return;
    }

    setInstitution(inst as any);

    const [{ data: lic }, { data: inv }, { data: bch }] = await Promise.all([
      supabase.from("institution_licenses").select("*").eq("institution_id", inst.id).eq("status", "active").maybeSingle(),
      supabase.from("institution_invoices").select("*").eq("institution_id", inst.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("institution_batches").select("id, name, is_active").eq("institution_id", inst.id),
    ]);
    setLicense(lic);
    setInvoices((inv as any[]) || []);
    setBatches((bch as any[]) || []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const paid = invoices.filter(i => i.status === "paid");
    const pending = invoices.filter(i => i.status === "pending");
    return {
      revenue: paid.reduce((s, i) => s + Number(i.amount || 0), 0),
      pending: pending.reduce((s, i) => s + Number(i.amount || 0), 0),
      paidCount: paid.length,
      activeBatches: batches.filter(b => b.is_active).length,
      totalBatches: batches.length,
    };
  }, [invoices, batches]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">No Institution Linked</h1>
          <p className="text-sm text-muted-foreground">
            Your account is not the admin of any institution. Contact ACRY support to onboard your institute.
          </p>
          <button onClick={handleSignOut} className="w-full py-2.5 rounded-xl bg-secondary text-sm font-medium text-foreground hover:bg-secondary/80">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const TypeIcon = TYPE_ICON[institution.type] || Building2;
  const expiringSoon = license?.expires_at &&
    (new Date(license.expires_at).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000 &&
    (new Date(license.expires_at).getTime() - Date.now()) > 0;

  const KPIS = [
    { label: "Students", value: institution.student_count || 0, max: institution.max_students, icon: GraduationCap, color: "text-primary" },
    { label: "Faculty", value: institution.teacher_count || 0, icon: Users, color: "text-blue-400" },
    { label: "Active Batches", value: stats.activeBatches, icon: Layers, color: "text-emerald-400" },
    { label: "Revenue", value: `₹${(stats.revenue / 1000).toFixed(1)}K`, icon: IndianRupee, color: "text-success" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div
        className="relative overflow-hidden border-b border-border"
        style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)" }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-6xl mx-auto px-4 py-5 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${institution.primary_color}, ${institution.primary_color}99)` }}
          >
            {institution.logo_url ? (
              <img src={institution.logo_url} alt={institution.name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <TypeIcon className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-extrabold text-foreground truncate">{institution.name}</h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary capitalize">{institution.type}</span>
              {institution.is_active ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-success/15 text-success">Active</span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-destructive/15 text-destructive">Inactive</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {institution.city || "—"} {institution.branch ? `• ${institution.branch}` : ""} • Admin Panel
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0",
                tab === t.key
                  ? "bg-card border border-border shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              )}
            >
              <t.icon className={cn("w-3.5 h-3.5", tab === t.key ? t.color : "")} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {tab === "overview" && (
              <div className="space-y-5">
                {/* KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {KPIS.map(k => (
                    <div key={k.label} className="rounded-2xl bg-card border border-border p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <k.icon className={cn("w-3.5 h-3.5", k.color)} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</span>
                      </div>
                      <div className="text-2xl font-extrabold text-foreground">{k.value}</div>
                      {k.max && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">of {k.max} max</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* License */}
                <div className="rounded-2xl bg-card border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" /> License
                    </h3>
                    <button onClick={() => setTab("billing")} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                      Manage <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  {license ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-muted-foreground text-[10px]">Plan</div>
                        <div className="font-bold text-foreground capitalize">{license.plan_name}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px]">Status</div>
                        <div className="font-bold text-success capitalize">{license.status}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[10px]">Expires</div>
                        <div className={cn("font-bold", expiringSoon ? "text-warning" : "text-foreground")}>
                          {license.expires_at ? format(new Date(license.expires_at), "dd MMM yyyy") : "—"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No active license. Contact ACRY support.</p>
                  )}
                  {expiringSoon && (
                    <div className="mt-3 p-2.5 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                      <span className="text-[11px] text-warning">License expires soon. Renew to avoid service interruption.</span>
                    </div>
                  )}
                </div>

                {/* Recent Invoices */}
                <div className="rounded-2xl bg-card border border-border p-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-success" /> Recent Invoices
                  </h3>
                  {invoices.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No invoices yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {invoices.slice(0, 6).map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                          <div>
                            <div className="text-[11px] font-mono text-foreground">{inv.invoice_number}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {inv.student_count || 0} students • {format(new Date(inv.created_at), "dd MMM")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                              inv.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                            )}>{inv.status}</span>
                            <span className="text-xs font-bold text-foreground">₹{Number(inv.amount).toFixed(0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick links */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {TABS.filter(t => t.key !== "overview").slice(0, 4).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className="rounded-xl border border-border bg-card hover:bg-secondary/40 p-3 text-left transition-colors"
                    >
                      <t.icon className={cn("w-4 h-4 mb-1.5", t.color)} />
                      <div className="text-xs font-bold text-foreground">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground">Manage {t.label.toLowerCase()}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Suspense fallback={<Loader />}>
              {tab === "batches" && <BatchManagement institutionId={institution.id} institutionName={institution.name} />}
              {tab === "faculty" && <FacultyDashboard institutionId={institution.id} />}
              {tab === "branding" && <BrandingConfig institutionId={institution.id} institutionName={institution.name} />}
              {tab === "features" && <FeatureToggles institutionId={institution.id} institutionName={institution.name} />}
              {tab === "domains" && <DomainManagement institutionId={institution.id} institutionName={institution.name} />}
              {tab === "contracts" && <ContractManagement institutionId={institution.id} institutionName={institution.name} />}
              {tab === "billing" && <LicenseBilling institutionId={institution.id} institutionName={institution.name} />}
              {tab === "audit" && <InstitutionAuditLog institutionId={institution.id} institutionName={institution.name} />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
