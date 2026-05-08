import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode, Copy, Download, Share2, Link2, RefreshCw, MessageSquare,
  Sparkles, Loader2, CheckCircle2, Users, TrendingUp, IndianRupee,
  Wallet, Hourglass, BadgeCheck, Percent, ChevronRight, X,
  CalendarClock, ArrowRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths, startOfMonth, differenceInDays } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  institutionId: string;
  institutionName: string;
  view?: "share" | "earnings" | "all";
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

export default function InstituteOnboardingTab({ institutionId, institutionName, view = "all" }: Props) {
  const showShare = view === "share" || view === "all";
  const showEarnings = view === "earnings" || view === "all";
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

  // Always use the canonical ACRY brand domain for public invite links
  const BRAND_HOST = "acry.ai";
  const BRAND_BASE = `https://${BRAND_HOST}`;
  const referralCode = meta?.referral_code || "";
  const joinUrl = useMemo(
    () => (referralCode ? `${BRAND_BASE}/i/${referralCode}` : ""),
    [referralCode],
  );
  const joinUrlDisplay = useMemo(
    () => (referralCode ? `${BRAND_HOST}/i/${referralCode}` : ""),
    [referralCode],
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
    // Payout buckets: group PENDING by next 1st-of-month payout date
    const buckets: Record<string, { date: Date; amount: number; count: number }> = {};
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
      if (c.status === "paid") {
        bySource[src].paid += amt;
      } else if (c.status !== "reversed") {
        bySource[src].pending += amt;
        // Schedule: payouts on the 1st of the month AFTER the commission was earned
        const created = new Date(c.created_at);
        const payoutDate = startOfMonth(addMonths(created, 1));
        const key = format(payoutDate, "yyyy-MM");
        if (!buckets[key]) buckets[key] = { date: payoutDate, amount: 0, count: 0 };
        buckets[key].amount += amt;
        buckets[key].count += 1;
      }
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
    const schedule = Object.values(buckets)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);
    return {
      totalEarned, pending, paid, thisMonth, conversions,
      sourceRows, schedule,
      conversionRate: totalJoins ? Math.round((conversions / totalJoins) * 100) : 0,
      paidPct: totalEarned ? Math.round((paid / totalEarned) * 100) : 0,
      pendingPct: totalEarned ? Math.round((pending / totalEarned) * 100) : 0,
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
      {showShare && <>
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

      {/* Ultra-premium branded invite link */}
      <div
        className="relative rounded-2xl p-[1.5px] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accent}, #7C4DFF 45%, #00E5FF)`,
        }}
      >
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div
            className="absolute -top-10 -left-10 w-40 h-40 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
          />
          <div className="absolute -bottom-12 -right-12 w-44 h-44 rounded-full blur-3xl bg-[radial-gradient(circle,#00E5FF44,transparent_70%)]" />
        </div>
        <div className="relative rounded-[14px] bg-card/95 backdrop-blur-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${accent}, #7C4DFF)` }}
              >
                <Link2 className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground leading-tight">Public invite link</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">Branded · One-tap enroll · Source-tracked</p>
              </div>
            </div>
            <span
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-extrabold tracking-wider uppercase border"
              style={{
                borderColor: `${accent}55`,
                background: `linear-gradient(135deg, ${accent}22, #00E5FF22)`,
                color: accent,
              }}
            >
              <Sparkles className="w-2.5 h-2.5" /> ACRY.AI
            </span>
          </div>

          <div
            className="group relative flex items-center gap-2 rounded-xl px-3 py-3 border overflow-hidden"
            style={{
              borderColor: `${accent}40`,
              background: "linear-gradient(135deg, hsl(var(--secondary)/0.6), hsl(var(--card)/0.4))",
            }}
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: `${accent}22`, color: accent }}
              >
                https://
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-foreground truncate flex-1 tracking-tight">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {BRAND_HOST}
              </span>
              <span className="text-muted-foreground">/i/</span>
              <span
                className="bg-clip-text text-transparent font-extrabold"
                style={{ backgroundImage: `linear-gradient(135deg, ${accent}, #00E5FF)` }}
              >
                {referralCode || "—"}
              </span>
            </span>
            <button
              onClick={() => copy(joinUrl, "Invite link")}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-white shadow-lg transition-transform active:scale-95"
              style={{ background: `linear-gradient(135deg, ${accent}, #7C4DFF)` }}
            >
              <Copy className="w-3 h-3" /> COPY
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3">
            <p className="text-[11px] text-muted-foreground flex-1">
              Anyone opening this link signs up via OTP and is auto-enrolled as your student. The shortest, most premium invite on the internet.
            </p>
            <span
              className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            >
              <CheckCircle2 className="w-2.5 h-2.5" /> SSL · Verified
            </span>
          </div>
        </div>
      </div>
      </>}

      {showEarnings && <>
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

      {/* ───── ULTRA-PREMIUM Commission Earnings ───── */}
      <div
        className="relative overflow-hidden rounded-3xl border p-5"
        style={{
          background: `radial-gradient(ellipse 90% 70% at 100% 0%, #7C4DFF22 0%, hsl(var(--card)) 55%), radial-gradient(ellipse 70% 50% at 0% 100%, #10B98115 0%, transparent 60%)`,
          borderColor: "hsl(var(--border))",
        }}
      >
        {/* Animated orbs */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl pointer-events-none animate-pulse"
          style={{ background: "#7C4DFF22", animationDuration: "5s" }} />
        <div className="absolute -bottom-20 -left-12 w-56 h-56 rounded-full blur-3xl pointer-events-none animate-pulse"
          style={{ background: "#10B98118", animationDuration: "7s" }} />

        <div className="relative">
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "#7C4DFF20", border: "1px solid #7C4DFF40" }}>
                <Wallet className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-foreground">Commission Earnings</h3>
                <p className="text-[10px] text-muted-foreground">Realtime payout intelligence</p>
              </div>
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1"
              style={{ background: "#7C4DFF20", color: "#A78BFA", border: "1px solid #7C4DFF40" }}
            >
              <Percent className="w-3 h-3" />
              {Math.round((meta?.commission_rate ?? 0.2) * 100)}% rate
            </span>
          </div>

          {/* HERO: Paid vs Pending split */}
          <div className="rounded-2xl border border-border/60 bg-background/40 backdrop-blur p-4 mb-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Total Earned</div>
                <div className="text-3xl font-black tracking-tight tabular-nums"
                  style={{ background: "linear-gradient(135deg, #A78BFA, #10B981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {fmt(commissionStats.totalEarned)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">This Month</div>
                <div className="text-base font-extrabold text-cyan-400 tabular-nums">{fmt(commissionStats.thisMonth)}</div>
              </div>
            </div>

            {/* Dual segmented bar (Paid vs Pending) */}
            {commissionStats.totalEarned > 0 ? (
              <>
                <div className="h-3 rounded-full bg-secondary/60 overflow-hidden flex shadow-inner">
                  <div
                    className="h-full transition-all relative overflow-hidden"
                    style={{
                      width: `${commissionStats.paidPct}%`,
                      background: "linear-gradient(90deg, #10B981, #34D399)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />
                  </div>
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${commissionStats.pendingPct}%`,
                      background: "linear-gradient(90deg, #FBBF24, #F59E0B)",
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="rounded-xl p-2.5 border" style={{ background: "#10B98112", borderColor: "#10B98140" }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Paid Out</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <div className="text-lg font-black text-emerald-400 tabular-nums">{fmt(commissionStats.paid)}</div>
                      <span className="text-[10px] text-emerald-400/70 font-bold">{commissionStats.paidPct}%</span>
                    </div>
                  </div>
                  <div className="rounded-xl p-2.5 border" style={{ background: "#FBBF2412", borderColor: "#FBBF2440" }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Hourglass className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pending Payout</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <div className="text-lg font-black text-amber-400 tabular-nums">{fmt(commissionStats.pending)}</div>
                      <span className="text-[10px] text-amber-400/70 font-bold">{commissionStats.pendingPct}%</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-2 text-center">
                No conversions yet. Paid commissions will appear here.
              </p>
            )}

            {/* Conversion summary */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>
                  <span className="font-bold text-foreground">{commissionStats.conversions}</span> of{" "}
                  <span className="font-bold text-foreground">{totalJoins}</span> students converted
                </span>
              </div>
              <span className="font-bold text-success">{commissionStats.conversionRate}%</span>
            </div>
          </div>

          {/* PAYOUT SCHEDULE TIMELINE */}
          {commissionStats.schedule.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400" /> Payout Schedule
                </h4>
                <span className="text-[10px] text-muted-foreground">Monthly · 1st of next month</span>
              </div>
              <div className="relative">
                {/* Connector line */}
                <div className="absolute left-3 top-3 bottom-3 w-px bg-gradient-to-b from-amber-400/40 via-border to-transparent" />
                <div className="space-y-2">
                  {commissionStats.schedule.map((b, i) => {
                    const days = differenceInDays(b.date, new Date());
                    const isNext = i === 0;
                    return (
                      <div key={b.date.toISOString()} className="relative flex items-start gap-3">
                        {/* Node */}
                        <div className="relative z-10 shrink-0">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center border-2",
                            isNext
                              ? "bg-amber-500/20 border-amber-400 animate-pulse"
                              : "bg-secondary border-border"
                          )}>
                            {isNext ? (
                              <Zap className="w-3 h-3 text-amber-400" />
                            ) : (
                              <CalendarClock className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          "flex-1 rounded-xl p-2.5 border transition-colors",
                          isNext
                            ? "bg-amber-500/10 border-amber-500/40"
                            : "bg-secondary/30 border-border/50"
                        )}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className={cn(
                                "text-xs font-bold",
                                isNext ? "text-amber-400" : "text-foreground"
                              )}>
                                {format(b.date, "dd MMM yyyy")}
                                {isNext && (
                                  <span className="ml-1.5 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-400/40">
                                    Next
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {b.count} txn · {days > 0 ? `in ${days}d` : days === 0 ? "today" : `${Math.abs(days)}d ago`}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={cn("text-sm font-extrabold tabular-nums", isNext ? "text-amber-400" : "text-foreground")}>
                                {fmt(b.amount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Earnings by source (drill-through) */}
          {commissionStats.sourceRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Breakdown by Source
                </h4>
                <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                  Tap to drill <ArrowRight className="w-2.5 h-2.5" />
                </span>
              </div>
              <div className="space-y-1.5">
                {commissionStats.sourceRows.map((r) => {
                  const pct = commissionStats.totalEarned
                    ? Math.round((r.earned / commissionStats.totalEarned) * 100)
                    : 0;
                  return (
                    <button
                      key={r.source}
                      type="button"
                      onClick={() => setDrillSource(r.source)}
                      className="w-full text-left rounded-xl p-2.5 bg-background/40 border border-border/40 hover:border-primary/40 hover:bg-secondary/30 transition-all group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-foreground capitalize flex items-center gap-1.5">
                          <SourceDot source={r.source} />
                          {r.source}
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({r.conversions}/{r.joins})
                          </span>
                        </span>
                        <span className="font-extrabold text-foreground tabular-nums flex items-center gap-1">
                          {fmt(r.earned)}
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
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
                      <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Paid {fmt(r.paid)}
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Pending {fmt(r.pending)}
                        </span>
                        <span className="ml-auto text-muted-foreground font-semibold">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
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

