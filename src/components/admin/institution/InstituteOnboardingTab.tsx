import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Copy, Download, Share2, Link2, RefreshCw, MessageSquare,
  Sparkles, Loader2, CheckCircle2, Users, TrendingUp, IndianRupee,
  Wallet, Hourglass, BadgeCheck, Percent, ChevronRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  institutionId: string;
  institutionName: string;
}

interface InstMeta {
  referral_code: string;
  primary_color: string | null;
  logo_url: string | null;
  commission_rate: number | null;
}

interface SourceStat {
  source: string;
  count: number;
}

interface CommissionRow {
  id: string;
  source: string | null;
  gross_amount: number;
  commission_amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
}

const CommissionKpi = ({
  icon: Icon, label, value, color,
}: { icon: any; label: string; value: string; color: string }) => (
  <div
    className="rounded-2xl p-3.5 border"
    style={{
      background: `linear-gradient(135deg, ${color}14, transparent)`,
      borderColor: `${color}30`,
    }}
  >
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
    <div className="text-xl font-extrabold text-foreground">{value}</div>
  </div>
);

export default function InstituteOnboardingTab({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [meta, setMeta] = useState<InstMeta | null>(null);
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [totalJoins, setTotalJoins] = useState(0);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [drillSource, setDrillSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [rotating, setRotating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!institutionId) return;
    load();
  }, [institutionId]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: inst }, { data: members }, { data: comm }] = await Promise.all([
        supabase
          .from("institutions")
          .select("referral_code, primary_color, logo_url, commission_rate")
          .eq("id", institutionId)
          .maybeSingle(),
        supabase
          .from("institution_members")
          .select("source")
          .eq("institution_id", institutionId)
          .eq("role", "student"),
        supabase
          .from("institution_commissions")
          .select("id, source, gross_amount, commission_amount, currency, status, created_at, paid_at")
          .eq("institution_id", institutionId)
          .order("created_at", { ascending: false }),
      ]);

      setMeta(inst as any);

      const counts: Record<string, number> = {};
      (members || []).forEach((m: any) => {
        const src = (m.source || "direct") as string;
        counts[src] = (counts[src] || 0) + 1;
      });
      const arr = Object.entries(counts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);
      setStats(arr);
      setTotalJoins((members || []).length);
      setCommissions(((comm as any[]) || []) as CommissionRow[]);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralCode = meta?.referral_code || "";
  const joinUrl = useMemo(
    () => (referralCode ? `${baseUrl}/join/${referralCode}` : ""),
    [baseUrl, referralCode],
  );
  const accent = meta?.primary_color || "#6366f1";

  // Generate QR
  useEffect(() => {
    if (!joinUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, joinUrl, {
      width: 280,
      margin: 1,
      color: { dark: "#0B0F1A", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).catch(() => {});
    QRCode.toDataURL(joinUrl, {
      width: 800,
      margin: 2,
      color: { dark: "#0B0F1A", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).then(setQrDataUrl).catch(() => {});
  }, [joinUrl]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied ✅` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${institutionName.replace(/\s+/g, "_")}_QR.png`;
    a.click();
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `Join ${institutionName} on ACRY 🚀\n\nUse this link to enroll instantly:\n${joinUrl}\n\nOr enter referral code: ${referralCode}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      copy(joinUrl, "Invite link");
      return;
    }
    try {
      await navigator.share({
        title: `Join ${institutionName}`,
        text: `Enroll at ${institutionName} on ACRY`,
        url: joinUrl,
      });
    } catch {}
  };

  const rotateCode = async () => {
    if (!confirm("Generating a new code will invalidate all existing QR codes and links. Continue?")) return;
    setRotating(true);
    try {
      // Generate via DB-side via update to NULL then trigger fires? Trigger only on INSERT.
      // Compute client-side fallback then check uniqueness via update with random retry
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 7; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
      const { error } = await supabase
        .from("institutions")
        .update({ referral_code: code } as any)
        .eq("id", institutionId);
      if (error) throw error;
      toast({ title: "New code generated 🔄" });
      load();
    } catch (e: any) {
      toast({ title: "Rotation failed", description: e.message, variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  // ───── Commission analytics ─────
  const commissionStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let totalEarned = 0, pending = 0, paid = 0, thisMonth = 0;
    let conversions = 0;
    const bySource: Record<string, { count: number; earned: number; pending: number; paid: number }> = {};
    commissions.forEach((c) => {
      const amt = Number(c.commission_amount || 0);
      totalEarned += amt;
      if (c.status === "paid") paid += amt;
      else if (c.status !== "reversed") pending += amt;
      if (new Date(c.created_at).getTime() >= monthStart) thisMonth += amt;
      conversions += 1;
      const src = c.source || "direct";
      if (!bySource[src]) bySource[src] = { count: 0, earned: 0, pending: 0, paid: 0 };
      bySource[src].count += 1;
      bySource[src].earned += amt;
      if (c.status === "paid") bySource[src].paid += amt;
      else if (c.status !== "reversed") bySource[src].pending += amt;
    });
    const sourceRows = Object.entries(bySource)
      .map(([source, v]) => ({
        source,
        conversions: v.count,
        earned: v.earned,
        pending: v.pending,
        paid: v.paid,
        joins: stats.find((s) => s.source === source)?.count ?? 0,
      }))
      .sort((a, b) => b.earned - a.earned);
    return {
      totalEarned, pending, paid, thisMonth, conversions,
      sourceRows,
      conversionRate: totalJoins ? Math.round((conversions / totalJoins) * 100) : 0,
    };
  }, [commissions, stats, totalJoins]);

  const fmt = (n: number, currency = "INR") =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const drillRows = drillSource
    ? commissions
        .filter((c) => (c.source || "direct") === drillSource)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];
  const drillTotals = drillRows.reduce(
    (acc, c) => {
      const amt = Number(c.commission_amount || 0);
      acc.total += amt;
      if (c.status === "paid") acc.paid += amt;
      else if (c.status !== "reversed") acc.pending += amt;
      return acc;
    },
    { total: 0, paid: 0, pending: 0 }
  );

  return (
    <>
    <div className="space-y-5">
      {/* Hero with QR */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border p-5"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}18 0%, hsl(var(--card)) 60%)`,
        }}
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: `${accent}25` }} />

        <div className="relative flex flex-col md:flex-row gap-5 items-center md:items-stretch">
          {/* QR */}
          <div className="shrink-0">
            <div
              className="rounded-2xl p-4 bg-white shadow-2xl"
              style={{ boxShadow: `0 25px 50px -12px ${accent}50` }}
            >
              <canvas ref={canvasRef} className="block" />
            </div>
          </div>

          {/* Right column */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Instant Onboarding
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-foreground leading-tight">
                Scan to join {institutionName}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Print this QR or share the link. Students get auto-mapped to your institute the moment they sign up.
              </p>
            </div>

            {/* Referral code chip */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-xl px-3 py-2.5 font-mono font-bold text-lg tracking-[0.3em] text-center text-foreground"
                style={{ background: `${accent}12`, border: `1px solid ${accent}40` }}
              >
                {referralCode}
              </div>
              <button
                onClick={() => copy(referralCode, "Referral code")}
                className="p-2.5 rounded-xl border border-border hover:bg-secondary transition-colors"
                title="Copy code"
              >
                <Copy className="w-4 h-4 text-foreground" />
              </button>
              <button
                onClick={rotateCode}
                disabled={rotating}
                className="p-2.5 rounded-xl border border-border hover:bg-secondary transition-colors"
                title="Rotate (invalidate old)"
              >
                {rotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-foreground" />}
              </button>
            </div>

            {/* Share row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <ActionBtn icon={Download} label="QR PNG" onClick={downloadQR} accent={accent} />
              <ActionBtn icon={MessageSquare} label="WhatsApp" onClick={shareWhatsApp} accent="#25D366" />
              <ActionBtn icon={Share2} label="Share" onClick={nativeShare} accent={accent} />
              <ActionBtn icon={Copy} label="Copy link" onClick={() => copy(joinUrl, "Invite link")} accent={accent} />
            </div>
          </div>
        </div>
      </div>

      {/* Invite link box */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Link2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Public invite link</h3>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2.5">
          <span className="text-xs font-mono text-foreground/80 truncate flex-1">{joinUrl}</span>
          <button
            onClick={() => copy(joinUrl, "Invite link")}
            className="text-[11px] font-bold text-primary hover:underline shrink-0"
          >
            COPY
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Anyone opening this link signs up via OTP and is auto-enrolled as a student of your institute.
        </p>
      </div>

      {/* Source attribution analytics */}
      <div className="rounded-2xl bg-card border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Source Attribution
          </h3>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> {totalJoins} total students
          </span>
        </div>

        {stats.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No students enrolled yet. Share your QR or link to start tracking.
          </p>
        ) : (
          <div className="space-y-2">
            {stats.map((s) => {
              const pct = totalJoins ? Math.round((s.count / totalJoins) * 100) : 0;
              return (
                <div key={s.source}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-foreground capitalize flex items-center gap-1.5">
                      <SourceDot source={s.source} />
                      {s.source}
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-bold text-foreground">{s.count}</span> · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: sourceColor(s.source),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ───── Commission Analytics ───── */}
      <div
        className="relative overflow-hidden rounded-3xl border p-5"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 0% 0%, #7C4DFF18 0%, hsl(var(--card)) 60%)`,
          borderColor: "hsl(var(--border))",
        }}
      >
        <div className="absolute -top-12 -left-12 w-56 h-56 rounded-full blur-3xl pointer-events-none bg-purple-500/15" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-4 h-4 text-purple-400" /> Commission Earnings
            </h3>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1"
              style={{ background: "#7C4DFF20", color: "#A78BFA", border: "1px solid #7C4DFF40" }}
            >
              <Percent className="w-3 h-3" />
              {Math.round((meta?.commission_rate ?? 0.2) * 100)}% rate
            </span>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <CommissionKpi
              icon={IndianRupee}
              label="Total Earned"
              value={fmt(commissionStats.totalEarned)}
              color="#A78BFA"
            />
            <CommissionKpi
              icon={Hourglass}
              label="Pending Payout"
              value={fmt(commissionStats.pending)}
              color="#FBBF24"
            />
            <CommissionKpi
              icon={BadgeCheck}
              label="Paid Out"
              value={fmt(commissionStats.paid)}
              color="#10B981"
            />
            <CommissionKpi
              icon={TrendingUp}
              label="This Month"
              value={fmt(commissionStats.thisMonth)}
              color="#00E5FF"
            />
          </div>

          {/* Conversion summary */}
          <div className="rounded-xl bg-secondary/40 border border-border p-3 mb-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>
                  <span className="font-bold text-foreground">{commissionStats.conversions}</span> paid conversions
                  {" "}from <span className="font-bold text-foreground">{totalJoins}</span> students
                </span>
              </div>
              <span className="font-bold text-success">{commissionStats.conversionRate}%</span>
            </div>
          </div>

          {/* Earnings by source */}
          {commissionStats.sourceRows.length > 0 && (
            <div>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Earnings by Source
              </h4>
              <div className="space-y-2">
                {commissionStats.sourceRows.map((r) => {
                  const pct = commissionStats.totalEarned
                    ? Math.round((r.earned / commissionStats.totalEarned) * 100)
                    : 0;
                  return (
                    <button
                      key={r.source}
                      type="button"
                      onClick={() => setDrillSource(r.source)}
                      className="w-full text-left rounded-lg p-2 -mx-2 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-foreground capitalize flex items-center gap-1.5">
                          <SourceDot source={r.source} />
                          {r.source}
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({r.conversions}/{r.joins} converted)
                          </span>
                        </span>
                        <span className="font-bold text-foreground flex items-center gap-1">
                          {fmt(r.earned)}
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden flex">
                        {r.earned > 0 && (
                          <>
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${Math.round((r.paid / r.earned) * pct)}%`,
                                background: "#10B981",
                              }}
                            />
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${Math.round((r.pending / r.earned) * pct)}%`,
                                background: "#FBBF24",
                              }}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px]">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Paid {fmt(r.paid)}
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Pending {fmt(r.pending)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent ledger */}
          {commissions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Recent Commissions
              </h4>
              <div className="space-y-1.5">
                {commissions.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-foreground capitalize flex items-center gap-1.5">
                        <SourceDot source={c.source || "direct"} />
                        {c.source || "direct"}
                        <span className="text-muted-foreground font-normal">
                          • gross {fmt(Number(c.gross_amount), c.currency)}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "dd MMM yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                          c.status === "paid" && "bg-success/15 text-success",
                          c.status === "pending" && "bg-warning/15 text-warning",
                          c.status === "approved" && "bg-primary/15 text-primary",
                          c.status === "reversed" && "bg-destructive/15 text-destructive",
                        )}
                      >
                        {c.status}
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {fmt(Number(c.commission_amount), c.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {commissions.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No paid conversions yet. Commissions appear here automatically when a referred student subscribes.
            </p>
          )}
        </div>
      </div>

      {/* Tips */}
      <div
        className="rounded-2xl border p-4"
        style={{
          background: `linear-gradient(135deg, ${accent}10, transparent)`,
          borderColor: `${accent}30`,
        }}
      >
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: accent }} /> Pro tips
        </h4>
        <ul className="space-y-1 text-[11px] text-muted-foreground leading-relaxed">
          <li>• Print the QR poster and place it at your front desk for instant enrollments.</li>
          <li>• Put the invite link in your Instagram bio and YouTube descriptions for source tracking.</li>
          <li>• Share via WhatsApp broadcast — every join is attributed back to your institute.</li>
          <li>• Rotate the code when a campaign ends to keep analytics clean.</li>
        </ul>
      </div>
    </div>

    <Dialog open={!!drillSource} onOpenChange={(o) => !o && setDrillSource(null)}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 capitalize text-base">
            {drillSource && <SourceDot source={drillSource} />}
            {drillSource} commissions
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-secondary/40 p-2">
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="text-sm font-bold text-foreground">{fmt(drillTotals.total)}</div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2">
            <div className="text-[9px] uppercase tracking-wide text-emerald-400">Paid</div>
            <div className="text-sm font-bold text-emerald-400">{fmt(drillTotals.paid)}</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-2">
            <div className="text-[9px] uppercase tracking-wide text-amber-400">Pending</div>
            <div className="text-sm font-bold text-amber-400">{fmt(drillTotals.pending)}</div>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-5 pb-5 space-y-1.5">
          {drillRows.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No commissions yet for this source.</p>
          )}
          {drillRows.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground">
                  {format(new Date(c.created_at), "dd MMM yyyy, HH:mm")}
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Gross {fmt(Number(c.gross_amount), c.currency)}
                  {c.paid_at && ` • Paid ${format(new Date(c.paid_at), "dd MMM")}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                    c.status === "paid" && "bg-emerald-500/15 text-emerald-400",
                    c.status === "pending" && "bg-amber-500/15 text-amber-400",
                    c.status === "approved" && "bg-primary/15 text-primary",
                    c.status === "reversed" && "bg-destructive/15 text-destructive",
                  )}
                >
                  {c.status}
                </span>
                <span className="text-xs font-bold text-foreground">
                  {fmt(Number(c.commission_amount), c.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

const ActionBtn = ({
  icon: Icon, label, onClick, accent,
}: { icon: any; label: string; onClick: () => void; accent: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02]",
    )}
    style={{
      background: `${accent}15`,
      color: accent,
      border: `1px solid ${accent}40`,
    }}
  >
    <Icon className="w-3.5 h-3.5" /> {label}
  </button>
);

const SourceDot = ({ source }: { source: string }) => (
  <span className="w-1.5 h-1.5 rounded-full" style={{ background: sourceColor(source) }} />
);

function sourceColor(source: string) {
  switch (source) {
    case "qr": return "#00E5FF";
    case "referral": return "#7C4DFF";
    case "whatsapp": return "#25D366";
    case "invite": return "#F59E0B";
    case "direct":
    default: return "#94A3B8";
  }
}

