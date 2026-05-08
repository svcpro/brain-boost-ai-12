import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, GraduationCap, Loader2, IndianRupee,
  TrendingUp, LogOut, BookOpen, Crown, Sparkles, Activity,
  ArrowUpRight, Wallet, Zap, Target, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const InstituteStudentsTab = lazy(() => import("@/components/admin/institution/InstituteStudentsTab"));
const InstituteOnboardingTab = lazy(() => import("@/components/admin/institution/InstituteOnboardingTab"));

interface Institution {
  id: string;
  name: string;
  slug: string;
  type: string;
  logo_url: string | null;
  primary_color: string;
  is_active: boolean;
  student_count: number;
  teacher_count: number;
  city: string | null;
  branch: string | null;
  max_students: number | null;
}

type Tab = "command" | "students" | "earnings";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "command", label: "Command", icon: Activity },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "earnings", label: "Earnings", icon: IndianRupee },
];

const TYPE_ICON: Record<string, any> = {
  coaching: BookOpen, school: GraduationCap, university: Crown, enterprise: Building2,
};

const Loader = () => (
  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
);

const fmtINR = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n)}`;

export default function InstituteAdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [tab, setTab] = useState<Tab>("command");
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    activeStudents7d: 0,
    paidStudents: 0,
    earnedTotal: 0,
    earnedPending: 0,
    earnedPaid: 0,
    earned30d: 0,
    commissionCount: 0,
  });

  useEffect(() => {
    if (!user) { navigate("/institute/login"); return; }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: inst } = await supabase
      .from("institutions")
      .select("*")
      .eq("admin_user_id", user.id)
      .maybeSingle();

    if (!inst) { setInstitution(null); setLoading(false); return; }
    setInstitution(inst as any);

    const [{ data: members }, { data: commissions }] = await Promise.all([
      supabase.from("institution_members")
        .select("user_id, joined_at, is_active")
        .eq("institution_id", (inst as any).id)
        .eq("role", "student"),
      supabase.from("institution_commissions")
        .select("commission_amount, status, created_at, user_id")
        .eq("institution_id", (inst as any).id),
    ]);

    const now = Date.now();
    const cutoff7 = now - 7 * 24 * 3600 * 1000;
    const cutoff30 = now - 30 * 24 * 3600 * 1000;
    const list = (members || []) as any[];
    const cms = (commissions || []) as any[];

    const paidUserIds = new Set(cms.filter(c => c.status !== "reversed").map(c => c.user_id));

    const earnedTotal = cms.filter(c => c.status !== "reversed").reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earnedPaid = cms.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earnedPending = cms.filter(c => c.status === "pending" || c.status === "approved").reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earned30d = cms.filter(c => c.status !== "reversed" && new Date(c.created_at).getTime() > cutoff30)
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0);

    setMetrics({
      totalStudents: list.length,
      activeStudents7d: list.filter(m => m.joined_at && new Date(m.joined_at).getTime() > cutoff7).length,
      paidStudents: paidUserIds.size,
      earnedTotal, earnedPending, earnedPaid, earned30d,
      commissionCount: cms.length,
    });

    setLoading(false);
  };

  const conversionRate = useMemo(() => {
    if (!metrics.totalStudents) return 0;
    return Math.round((metrics.paidStudents / metrics.totalStudents) * 100);
  }, [metrics]);

  const handleSignOut = async () => { await signOut(); navigate("/institute/login"); };

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
          <h1 className="text-xl font-bold text-foreground">No Institute Linked</h1>
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to any institute yet. Onboard your coaching, school or university in under a minute.
          </p>
          <button onClick={() => navigate("/institute/signup")} className="w-full py-2.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
            Onboard My Institute
          </button>
          <button onClick={handleSignOut} className="w-full py-2.5 rounded-xl bg-secondary text-sm font-medium text-foreground hover:bg-secondary/80">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const TypeIcon = TYPE_ICON[institution.type] || Building2;
  const brand = institution.primary_color || "#7C4DFF";

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-x-hidden">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-32 w-[28rem] h-[28rem] rounded-full opacity-30 blur-[120px] animate-pulse"
          style={{ background: `radial-gradient(circle, ${brand}, transparent 70%)`, animationDuration: "6s" }}
        />
        <div
          className="absolute -top-20 right-0 w-[24rem] h-[24rem] rounded-full opacity-25 blur-[120px] animate-pulse"
          style={{ background: "radial-gradient(circle, hsl(var(--success)), transparent 70%)", animationDuration: "8s" }}
        />
        <div
          className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[20rem] h-[20rem] rounded-full opacity-15 blur-[100px]"
          style={{ background: "radial-gradient(circle, #00E5FF, transparent 70%)" }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-border/40 backdrop-blur-xl bg-background/40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xl ring-2 ring-white/10 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${brand}, ${brand}88)` }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent" />
            {institution.logo_url ? (
              <img src={institution.logo_url} alt={institution.name} className="w-full h-full object-cover relative z-10" />
            ) : (
              <TypeIcon className="w-6 h-6 text-white relative z-10" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-extrabold text-foreground truncate tracking-tight">{institution.name}</h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary capitalize">{institution.type}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Mission Control · {institution.city || "Global"}
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

        {/* Tabs - segmented pill */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="flex gap-1 p-1 rounded-2xl bg-secondary/40 backdrop-blur border border-border/50 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === t.key && (
                  <motion.div
                    layoutId="tabPill"
                    className="absolute inset-0 rounded-xl shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${brand}33, ${brand}15)`, border: `1px solid ${brand}55` }}
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
                <t.icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {tab === "command" && (
              <div className="space-y-5">
                {/* Hero dual focus: Students + Earnings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Students Card */}
                  <motion.button
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setTab("students")}
                    className="relative overflow-hidden rounded-3xl p-5 text-left group"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 blur-3xl group-hover:opacity-50 transition-opacity"
                      style={{ background: "radial-gradient(circle, #10B981, transparent 70%)" }} />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/15 ring-1 ring-emerald-500/30">
                            <GraduationCap className="w-4.5 h-4.5 text-emerald-400" />
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Students</div>
                            <div className="text-[9px] text-emerald-400 font-semibold">Monitor & Track</div>
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                      <div className="flex items-end gap-2 mb-3">
                        <div className="text-4xl font-black text-foreground tracking-tight tabular-nums">{metrics.totalStudents}</div>
                        {institution.max_students && (
                          <div className="text-[10px] text-muted-foreground mb-1.5">/ {institution.max_students}</div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-background/40 backdrop-blur p-2 border border-border/30">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">New (7d)</div>
                          <div className="text-base font-extrabold text-emerald-400 tabular-nums">+{metrics.activeStudents7d}</div>
                        </div>
                        <div className="rounded-xl bg-background/40 backdrop-blur p-2 border border-border/30">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">Paid Conv.</div>
                          <div className="text-base font-extrabold text-foreground tabular-nums">{conversionRate}%</div>
                        </div>
                      </div>
                    </div>
                  </motion.button>

                  {/* Earnings Card */}
                  <motion.button
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setTab("earnings")}
                    className="relative overflow-hidden rounded-3xl p-5 text-left group"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 blur-3xl group-hover:opacity-50 transition-opacity"
                      style={{ background: `radial-gradient(circle, ${brand}, transparent 70%)` }} />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center ring-1"
                            style={{ background: `${brand}25`, borderColor: `${brand}55` }}>
                            <Wallet className="w-4.5 h-4.5" style={{ color: brand }} />
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Earnings</div>
                            <div className="text-[9px] font-semibold" style={{ color: brand }}>Commissions</div>
                          </div>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                          style={{ color: brand }} />
                      </div>
                      <div className="flex items-end gap-2 mb-3">
                        <div className="text-4xl font-black tracking-tight tabular-nums"
                          style={{ background: `linear-gradient(135deg, ${brand}, hsl(var(--success)))`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          {fmtINR(metrics.earnedTotal)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-background/40 backdrop-blur p-2 border border-border/30">
                          <div className="text-[9px] text-emerald-400 uppercase tracking-wide font-semibold">Paid Out</div>
                          <div className="text-base font-extrabold text-emerald-400 tabular-nums">{fmtINR(metrics.earnedPaid)}</div>
                        </div>
                        <div className="rounded-xl bg-background/40 backdrop-blur p-2 border border-border/30">
                          <div className="text-[9px] text-amber-400 uppercase tracking-wide font-semibold">Pending</div>
                          <div className="text-base font-extrabold text-amber-400 tabular-nums">{fmtINR(metrics.earnedPending)}</div>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                </div>

                {/* Live pulse strip */}
                <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-foreground">Live Pulse</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <PulseStat icon={Zap} label="Last 30d" value={fmtINR(metrics.earned30d)} accent="text-amber-400" />
                    <PulseStat icon={Target} label="Conversions" value={`${metrics.paidStudents}`} accent="text-primary" />
                    <PulseStat icon={Eye} label="Txns" value={`${metrics.commissionCount}`} accent="text-emerald-400" />
                  </div>
                </div>

                {/* Footer hint */}
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">
                    <Sparkles className="w-2.5 h-2.5 inline mr-1" />
                    Two missions. Track every student. Maximize every rupee.
                  </p>
                </div>
              </div>
            )}

            <Suspense fallback={<Loader />}>
              {tab === "students" && <InstituteStudentsTab institutionId={institution.id} institutionName={institution.name} />}
              {tab === "earnings" && <InstituteOnboardingTab institutionId={institution.id} institutionName={institution.name} />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function PulseStat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl bg-background/40 p-2.5 border border-border/30">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("w-3 h-3", accent)} />
        <span className="text-[9px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <div className="text-sm font-extrabold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
