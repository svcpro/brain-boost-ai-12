import { useEffect, useMemo, useState } from "react";
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

  // Generate a fully clean QR matrix. Branding stays outside the scannable area.
  useEffect(() => {
    if (!joinUrl) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(joinUrl, {
      type: "image/png",
      width: 1024,
      margin: 4,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => {
      if (!cancelled) setQrDataUrl("");
    });
    return () => { cancelled = true; };
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
          {/* Ultra-advanced QR with brand */}
          <div className="shrink-0 relative" style={{ width: 320 }}>

            {/* Card */}
            <div
              className="relative rounded-[24px] p-3 shadow-2xl"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #f1f5ff 100%)",
                boxShadow: `0 30px 60px -20px ${accent}66, 0 0 0 1px rgba(255,255,255,0.4) inset`,
              }}
            >
              {/* Brand header bar */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-t-2xl rounded-b-md mb-2"
                style={{
                  background: `linear-gradient(135deg, ${accent}, #7C4DFF 60%, #00E5FF)`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-white/95 flex items-center justify-center shadow-sm overflow-hidden">
                    {meta?.logo_url ? (
                      <img src={meta.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-black" style={{ color: accent }}>A</span>
                    )}
                  </div>
                  <span className="text-[10px] font-extrabold tracking-[0.18em] text-white uppercase">
                    Acry · {institutionName}
                  </span>
                </div>
                <span className="text-[8px] font-bold tracking-[0.18em] text-white/90 uppercase flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Live
                </span>
              </div>

              {/* QR – kept fully clean for reliable scanning. Brackets sit OUTSIDE the QR. */}
              <div className="relative bg-white p-3 rounded-xl">
                {/* Outer viewfinder corner brackets (do NOT overlap QR finder patterns) */}
                {[
                  "top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
                  "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
                  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md",
                ].map((c, i) => (
                  <span
                    key={i}
                    className={cn("absolute w-3 h-3 pointer-events-none", c)}
                    style={{ borderColor: accent }}
                  />
                ))}
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`ACRY invite QR code for ${institutionName}`}
                    className="block w-[280px] h-[280px] max-w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <div className="w-[280px] h-[280px] max-w-full grid place-items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Generating QR
                  </div>
                )}
              </div>

              {/* Footer band */}
              <div className="mt-2 px-2 pb-1 pt-2 rounded-b-xl flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Scan to join</span>
                  <span className="text-[11px] font-mono font-extrabold text-slate-900">
                    {BRAND_HOST}/i/<span style={{ color: accent }}>{referralCode}</span>
                  </span>
                </div>
                <div
                  className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md tracking-widest"
                  style={{ background: `${accent}18`, color: accent }}
                >
                  v2
                </div>
              </div>
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
      {/* ═══════════════ ULTRA VAULT HERO ═══════════════ */}
      <div
        className="relative overflow-hidden rounded-[28px] border border-border/60 p-5 sm:p-6"
        style={{
          background: `
            radial-gradient(ellipse 100% 80% at 50% 0%, #7C4DFF20 0%, transparent 60%),
            radial-gradient(ellipse 90% 60% at 100% 100%, #00E5FF18 0%, transparent 55%),
            radial-gradient(ellipse 80% 60% at 0% 100%, #10B98115 0%, transparent 60%),
            linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)
          `,
        }}
      >
        {/* Mesh grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 30%, transparent 80%)",
          }}
        />
        {/* Floating orbs */}
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none animate-pulse"
          style={{ background: "#7C4DFF30", animationDuration: "6s" }} />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full blur-3xl pointer-events-none animate-pulse"
          style={{ background: "#00E5FF20", animationDuration: "8s" }} />

        <div className="relative">
          {/* Header pill */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-md opacity-70" style={{ background: "linear-gradient(135deg, #7C4DFF, #00E5FF)" }} />
                <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #7C4DFF, #00E5FF)" }}>
                  <Wallet className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">ACRY Vault</div>
                <h3 className="text-base font-black text-foreground leading-tight">Earnings Intelligence</h3>
              </div>
            </div>
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg flex items-center gap-1 backdrop-blur"
              style={{ background: "linear-gradient(135deg, #7C4DFF20, #00E5FF20)", color: "#A78BFA", border: "1px solid #7C4DFF50" }}
            >
              <Percent className="w-3 h-3" />
              {Math.round((meta?.commission_rate ?? 0.2) * 100)}%
            </span>
          </div>

          {/* HERO RING + TOTAL */}
          <div className="grid grid-cols-[auto,1fr] gap-5 items-center mb-5">
            {/* SVG Radial Ring */}
            <div className="relative w-[124px] h-[124px] shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <defs>
                  <linearGradient id="ringPaid" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#34D399" />
                  </linearGradient>
                  <linearGradient id="ringPending" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                </defs>
                {/* Track */}
                <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" opacity="0.3" />
                {/* Pending arc (drawn first, below paid) */}
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke="url(#ringPending)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(commissionStats.pendingPct + commissionStats.paidPct) * 3.14159} 999`}
                  style={{ transition: "stroke-dasharray 0.8s ease" }}
                />
                {/* Paid arc on top */}
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke="url(#ringPaid)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${commissionStats.paidPct * 3.14159} 999`}
                  style={{ transition: "stroke-dasharray 0.8s ease", filter: "drop-shadow(0 0 6px #10B98180)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Paid</div>
                <div className="text-2xl font-black tabular-nums text-emerald-400 leading-none">{commissionStats.paidPct}%</div>
                <div className="text-[9px] text-amber-400/80 font-bold mt-0.5">+{commissionStats.pendingPct}% pending</div>
              </div>
            </div>

            {/* Total + this month */}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Lifetime Earned</div>
              <div className="text-[40px] leading-none font-black tracking-tight tabular-nums truncate"
                style={{ background: "linear-gradient(135deg, #ffffff 0%, #A78BFA 50%, #00E5FF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {fmt(commissionStats.totalEarned)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "#00E5FF15", border: "1px solid #00E5FF40" }}>
                  <CalendarClock className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] font-bold text-cyan-400">This month</span>
                  <span className="text-[11px] font-extrabold text-cyan-300 tabular-nums">{fmt(commissionStats.thisMonth)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* KPI TRIO — glass tiles */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="relative rounded-2xl p-3 overflow-hidden border border-emerald-500/30"
              style={{ background: "linear-gradient(135deg, #10B98120, #10B98105)" }}>
              <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl" style={{ background: "#10B98140" }} />
              <div className="relative">
                <BadgeCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <div className="text-[9px] uppercase tracking-wider font-bold text-emerald-400/80">Paid</div>
                <div className="text-base font-black text-emerald-400 tabular-nums leading-tight truncate">{fmt(commissionStats.paid)}</div>
              </div>
            </div>
            <div className="relative rounded-2xl p-3 overflow-hidden border border-amber-500/30"
              style={{ background: "linear-gradient(135deg, #FBBF2420, #FBBF2405)" }}>
              <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl" style={{ background: "#FBBF2440" }} />
              <div className="relative">
                <Hourglass className="w-4 h-4 text-amber-400 mb-1" />
                <div className="text-[9px] uppercase tracking-wider font-bold text-amber-400/80">Pending</div>
                <div className="text-base font-black text-amber-400 tabular-nums leading-tight truncate">{fmt(commissionStats.pending)}</div>
              </div>
            </div>
            <div className="relative rounded-2xl p-3 overflow-hidden border border-cyan-500/30"
              style={{ background: "linear-gradient(135deg, #00E5FF20, #00E5FF05)" }}>
              <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full blur-2xl" style={{ background: "#00E5FF40" }} />
              <div className="relative">
                <Zap className="w-4 h-4 text-cyan-400 mb-1" />
                <div className="text-[9px] uppercase tracking-wider font-bold text-cyan-400/80">Conv. Rate</div>
                <div className="text-base font-black text-cyan-400 tabular-nums leading-tight">{commissionStats.conversionRate}%</div>
              </div>
            </div>
          </div>

          {/* Conversion bar */}
          <div className="rounded-2xl bg-background/40 backdrop-blur border border-border/40 p-3 mb-5">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                {commissionStats.conversions} of {totalJoins} students converted
              </span>
              <span className="font-black text-emerald-400 tabular-nums">{commissionStats.conversionRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  width: `${commissionStats.conversionRate}%`,
                  background: "linear-gradient(90deg, #10B981, #00E5FF)",
                  transition: "width 0.8s ease",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />
              </div>
            </div>
          </div>

          {/* PAYOUT TIMELINE — horizontal scroll cards */}
          {commissionStats.schedule.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-400" /> Upcoming Payouts
                </h4>
                <span className="text-[9px] text-muted-foreground font-semibold">1st of month</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                {commissionStats.schedule.map((b, i) => {
                  const days = differenceInDays(b.date, new Date());
                  const isNext = i === 0;
                  return (
                    <div
                      key={b.date.toISOString()}
                      className={cn(
                        "shrink-0 w-[140px] rounded-2xl p-3 border snap-start relative overflow-hidden transition-all",
                        isNext
                          ? "border-amber-400/60 bg-gradient-to-br from-amber-500/15 to-amber-500/5"
                          : "border-border/50 bg-background/40"
                      )}
                    >
                      {isNext && (
                        <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full blur-2xl bg-amber-400/40 animate-pulse" />
                      )}
                      <div className="relative">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className={cn(
                            "w-6 h-6 rounded-lg flex items-center justify-center",
                            isNext ? "bg-amber-400/25" : "bg-secondary"
                          )}>
                            {isNext ? <Zap className="w-3 h-3 text-amber-400" /> : <CalendarClock className="w-3 h-3 text-muted-foreground" />}
                          </div>
                          {isNext && (
                            <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 border border-amber-400/40">
                              Next
                            </span>
                          )}
                        </div>
                        <div className={cn("text-[10px] font-bold uppercase tracking-wider", isNext ? "text-amber-400" : "text-muted-foreground")}>
                          {format(b.date, "dd MMM")}
                        </div>
                        <div className={cn("text-base font-black tabular-nums leading-tight", isNext ? "text-amber-400" : "text-foreground")}>
                          {fmt(b.amount)}
                        </div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          {b.count} txn · {days > 0 ? `${days}d left` : days === 0 ? "today" : `${Math.abs(days)}d ago`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SOURCE BREAKDOWN */}
          {commissionStats.sourceRows.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Revenue by Channel
                </h4>
                <span className="text-[9px] text-muted-foreground flex items-center gap-1 font-semibold">
                  Tap to drill <ArrowRight className="w-2.5 h-2.5" />
                </span>
              </div>
              <div className="space-y-1.5">
                {commissionStats.sourceRows.map((r) => {
                  const pct = commissionStats.totalEarned
                    ? Math.round((r.earned / commissionStats.totalEarned) * 100)
                    : 0;
                  const color = sourceColor(r.source);
                  return (
                    <button
                      key={r.source}
                      type="button"
                      onClick={() => setDrillSource(r.source)}
                      className="w-full text-left rounded-2xl p-3 bg-background/40 border border-border/40 hover:border-primary/40 hover:bg-secondary/30 transition-all group relative overflow-hidden"
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
                      />
                      <div className="flex items-center justify-between text-xs mb-2 pl-2">
                        <span className="font-bold text-foreground capitalize flex items-center gap-1.5">
                          <SourceDot source={r.source} />
                          {r.source}
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({r.conversions}/{r.joins})
                          </span>
                        </span>
                        <span className="font-black text-foreground tabular-nums flex items-center gap-1">
                          {fmt(r.earned)}
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </span>
                      </div>
                      <div className="pl-2 h-1.5 rounded-full bg-secondary/60 overflow-hidden flex">
                        {r.earned > 0 && (
                          <>
                            <div className="h-full transition-all" style={{ width: `${Math.round((r.paid / r.earned) * pct)}%`, background: "#10B981" }} />
                            <div className="h-full transition-all" style={{ width: `${Math.round((r.pending / r.earned) * pct)}%`, background: "#FBBF24" }} />
                          </>
                        )}
                      </div>
                      <div className="pl-2 flex items-center gap-3 mt-1.5 text-[10px]">
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
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center bg-background/30">
              <Wallet className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground font-semibold">No commissions yet</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Earnings appear automatically when a referred student subscribes.</p>
            </div>
          )}
        </div>
      </div>

      {/* Source attribution analytics — secondary panel */}
      {stats.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Student Sources
            </h3>
            <span className="text-[11px] text-muted-foreground">
              <span className="font-bold text-foreground">{totalJoins}</span> total
            </span>
          </div>
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
                      style={{ width: `${pct}%`, background: sourceColor(s.source) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
      </>}
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

