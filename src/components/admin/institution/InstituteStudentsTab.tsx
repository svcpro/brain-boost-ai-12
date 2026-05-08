import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Search, Users, GraduationCap, Mail, Phone, ShieldOff, ShieldCheck,
  Calendar, Filter, ChevronRight, IndianRupee, Activity, Crown, Clock, X,
  TrendingUp, Sparkles
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  institutionId: string;
  institutionName: string;
}

interface StudentRow {
  id: string;
  user_id: string;
  is_active: boolean;
  joined_at: string;
  source: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  exam_type: string | null;
  plan_id: string | null;
  is_trial: boolean;
  sub_status: string | null;
  sub_amount: number;
  sub_currency: string | null;
  billing_cycle: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  sub_expires_at: string | null;
  last_seen_at: string | null;
  earned: number;
  paid: number;
  pending: number;
  txns: number;
  // Engagement (from leads)
  stage: string | null;
  lead_score: number;
  study_hours_7d: number;
  streak_days: number;
  exam_count: number;
  lead_last_active_at: string | null;
  // Batch
  batch_name: string | null;
  batch_year: string | null;
  roll_number: string | null;
}

type Filter = "all" | "active" | "revoked" | "paid" | "trial" | "free";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paid", label: "Paid" },
  { key: "trial", label: "Trial" },
  { key: "free", label: "Free" },
  { key: "revoked", label: "Revoked" },
];

const fmtINR = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n || 0)}`;

const planLabel = (s: StudentRow) => {
  if (!s.sub_status) return "Free";
  if (s.is_trial) return "Trial";
  if (s.sub_amount > 0 && s.sub_status === "active") return "Paid";
  return s.sub_status === "active" ? "Free" : (s.sub_status || "Free");
};

const planTone = (s: StudentRow) => {
  const l = planLabel(s);
  if (l === "Paid") return "bg-success/15 text-success border-success/30";
  if (l === "Trial") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-muted/40 text-muted-foreground border-border";
};

export default function InstituteStudentsTab({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [drill, setDrill] = useState<StudentRow | null>(null);

  useEffect(() => {
    if (!institutionId) return;
    load();
  }, [institutionId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: members, error } = await supabase
        .from("institution_members")
        .select("id, user_id, is_active, joined_at, source")
        .eq("institution_id", institutionId)
        .eq("role", "student")
        .order("joined_at", { ascending: false });
      if (error) throw error;

      const ids = (members || []).map((m) => m.user_id);
      let profilesById: Record<string, any> = {};
      let subsById: Record<string, any> = {};
      const earnings: Record<string, { earned: number; paid: number; pending: number; txns: number }> = {};

      if (ids.length > 0) {
        const [{ data: profs }, { data: subs }, { data: cms }] = await Promise.all([
          supabase.from("profiles").select("id, display_name, email, phone, avatar_url").in("id", ids),
          supabase.from("user_subscriptions")
            .select("user_id, plan_id, status, is_trial, amount, trial_end_date, updated_at")
            .in("user_id", ids),
          supabase.from("institution_commissions")
            .select("user_id, commission_amount, status")
            .eq("institution_id", institutionId)
            .in("user_id", ids),
        ]);
        (profs || []).forEach((p: any) => (profilesById[p.id] = p));
        (subs || []).forEach((s: any) => {
          // Prefer most recent
          const prev = subsById[s.user_id];
          if (!prev || new Date(s.updated_at) > new Date(prev.updated_at)) subsById[s.user_id] = s;
        });
        (cms || []).forEach((c: any) => {
          const k = c.user_id;
          if (!earnings[k]) earnings[k] = { earned: 0, paid: 0, pending: 0, txns: 0 };
          const amt = Number(c.commission_amount || 0);
          if (c.status !== "reversed") {
            earnings[k].earned += amt;
            earnings[k].txns += 1;
            if (c.status === "paid") earnings[k].paid += amt;
            else earnings[k].pending += amt;
          }
        });
      }

      const merged: StudentRow[] = (members || []).map((m: any) => {
        const p = profilesById[m.user_id] || {};
        const s = subsById[m.user_id] || {};
        const e = earnings[m.user_id] || { earned: 0, paid: 0, pending: 0, txns: 0 };
        return {
          id: m.id,
          user_id: m.user_id,
          is_active: !!m.is_active,
          joined_at: m.joined_at,
          source: m.source,
          display_name: p.display_name ?? null,
          email: p.email ?? null,
          phone: p.phone ?? null,
          avatar_url: p.avatar_url ?? null,
          plan_id: s.plan_id ?? null,
          is_trial: !!s.is_trial,
          sub_status: s.status ?? null,
          sub_amount: Number(s.amount || 0),
          last_seen_at: s.updated_at ?? null,
          trial_end_date: s.trial_end_date ?? null,
          ...e,
        };
      });
      setStudents(merged);
    } catch (e: any) {
      toast({ title: "Failed to load students", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (row: StudentRow) => {
    setBusy(row.id);
    try {
      const { error } = await supabase
        .from("institution_members")
        .update({ is_active: !row.is_active })
        .eq("id", row.id)
        .eq("institution_id", institutionId);
      if (error) throw error;
      setStudents((s) => s.map((x) => (x.id === row.id ? { ...x, is_active: !row.is_active } : x)));
      toast({ title: row.is_active ? "Access revoked" : "Access restored" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const hay = [s.display_name, s.email, s.phone, s.source].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const label = planLabel(s);
      switch (filter) {
        case "active": return s.is_active;
        case "revoked": return !s.is_active;
        case "paid": return label === "Paid";
        case "trial": return label === "Trial";
        case "free": return label === "Free";
        default: return true;
      }
    });
  }, [students, search, filter]);

  const stats = useMemo(() => {
    const paid = students.filter((s) => planLabel(s) === "Paid").length;
    const trial = students.filter((s) => planLabel(s) === "Trial").length;
    return {
      total: students.length,
      active: students.filter((s) => s.is_active).length,
      paid, trial,
      earned: students.reduce((s, x) => s + x.earned, 0),
    };
  }, [students]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Paid", value: stats.paid, icon: Crown, color: "text-success" },
          { label: "Trial", value: stats.trial, icon: Sparkles, color: "text-amber-400" },
          { label: "Earned", value: fmtINR(stats.earned), icon: IndianRupee, color: "text-emerald-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl bg-card/70 backdrop-blur border border-border/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-1">
              <k.icon className={cn("w-3.5 h-3.5", k.color)} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{k.label}</span>
            </div>
            <div className="text-xl font-extrabold text-foreground tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone or source…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/60 backdrop-blur border-border/60"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap border transition-all shrink-0",
                  active
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-secondary/40 text-muted-foreground border-border/40 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            );
          })}
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{filtered.length} shown</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card/60 backdrop-blur border border-border/60 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <GraduationCap className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No students match</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try clearing filters or invite students to {institutionName}.
            </p>
          </div>
        ) : (
          <>
            {/* Header row (md+) */}
            <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_0.9fr_0.9fr_0.9fr_auto] gap-3 px-4 py-2.5 border-b border-border/60 bg-secondary/20 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              <div>Student</div>
              <div>Status</div>
              <div>Plan</div>
              <div>Joined</div>
              <div>Last Active</div>
              <div className="text-right">Earned</div>
            </div>
            <div className="divide-y divide-border/50">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDrill(s)}
                  className="w-full text-left grid md:grid-cols-[1.6fr_0.8fr_0.9fr_0.9fr_0.9fr_auto] grid-cols-1 gap-3 items-center px-4 py-3 hover:bg-secondary/30 transition-colors group"
                >
                  {/* Student */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border/60">
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-foreground">
                          {(s.display_name || s.email || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{s.display_name || "Unnamed"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {s.email || s.phone || "—"}
                      </div>
                    </div>
                  </div>
                  {/* Status */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border",
                        s.is_active
                          ? "bg-success/10 text-success border-success/30"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", s.is_active ? "bg-success" : "bg-destructive")} />
                      {s.is_active ? "Active" : "Revoked"}
                    </span>
                  </div>
                  {/* Plan */}
                  <div>
                    <span className={cn("inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border", planTone(s))}>
                      {planLabel(s)}
                    </span>
                  </div>
                  {/* Joined */}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(s.joined_at), "dd MMM yy")}
                  </div>
                  {/* Last active */}
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {s.last_seen_at ? formatDistanceToNow(new Date(s.last_seen_at), { addSuffix: true }) : "—"}
                  </div>
                  {/* Earned + drill */}
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-emerald-400 tabular-nums">{fmtINR(s.earned)}</div>
                      {s.txns > 0 && <div className="text-[9px] text-muted-foreground">{s.txns} txn</div>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Drill modal */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {drill && (
            <>
              <DialogHeader className="p-5 pb-3 border-b border-border bg-gradient-to-br from-card to-secondary/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden ring-2 ring-border">
                    {drill.avatar_url ? (
                      <img src={drill.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-extrabold">
                        {(drill.display_name || drill.email || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-base font-extrabold truncate text-left">
                      {drill.display_name || "Unnamed Student"}
                    </DialogTitle>
                    <div className="text-[11px] text-muted-foreground truncate text-left">
                      {drill.email || drill.phone || "—"}
                    </div>
                  </div>
                </div>
              </DialogHeader>
              <div className="p-5 space-y-4">
                {/* Status row */}
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone={drill.is_active ? "success" : "destructive"}>
                    {drill.is_active ? "Access Active" : "Access Revoked"}
                  </Pill>
                  <Pill tone={planLabel(drill) === "Paid" ? "success" : planLabel(drill) === "Trial" ? "amber" : "muted"}>
                    {planLabel(drill)}{drill.plan_id ? ` · ${drill.plan_id}` : ""}
                  </Pill>
                  {drill.source && <Pill tone="muted">via {drill.source}</Pill>}
                </div>

                {/* Learning */}
                <Section icon={GraduationCap} title="Learning">
                  <Row label="Joined" value={format(new Date(drill.joined_at), "dd MMM yyyy")} />
                  <Row
                    label="Last Active"
                    value={drill.last_seen_at ? formatDistanceToNow(new Date(drill.last_seen_at), { addSuffix: true }) : "Never"}
                  />
                  {drill.is_trial && drill.trial_end_date && (
                    <Row label="Trial Ends" value={format(new Date(drill.trial_end_date), "dd MMM yyyy")} />
                  )}
                </Section>

                {/* Commission */}
                <Section icon={IndianRupee} title="Commission">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Earned" value={fmtINR(drill.earned)} tone="text-foreground" />
                    <Stat label="Paid" value={fmtINR(drill.paid)} tone="text-emerald-400" />
                    <Stat label="Pending" value={fmtINR(drill.pending)} tone="text-amber-400" />
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {drill.txns} transaction{drill.txns === 1 ? "" : "s"}
                  </div>
                </Section>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => toggleActive(drill)}
                    disabled={busy === drill.id}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors",
                      drill.is_active
                        ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                        : "border-success/30 text-success hover:bg-success/10",
                    )}
                  >
                    {busy === drill.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                    ) : drill.is_active ? (
                      <span className="flex items-center justify-center gap-1.5"><ShieldOff className="w-3.5 h-3.5" /> Revoke Access</span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Restore Access</span>
                    )}
                  </button>
                  <button
                    onClick={() => setDrill(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-secondary text-foreground hover:bg-secondary/70"
                  >
                    Close
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-wider font-bold text-foreground">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg bg-background/40 p-2 border border-border/40">
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide font-bold">{label}</div>
      <div className={cn("text-sm font-extrabold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "success" | "destructive" | "amber" | "muted"; children: React.ReactNode }) {
  const cls = {
    success: "bg-success/15 text-success border-success/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    muted: "bg-muted/40 text-muted-foreground border-border",
  }[tone];
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border", cls)}>{children}</span>;
}
