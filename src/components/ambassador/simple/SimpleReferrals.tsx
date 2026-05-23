import { Btn, Card, SectionTitle, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { useReferralHandle } from "@/hooks/useReferralHandle";
import { useReferralStats } from "./useReferralStats";
import {
  Copy,
  Share2,
  MessageCircle,
  Send,
  Instagram,
  Users,
  CheckCircle2,
  IndianRupee,
  TrendingUp,
  Sparkles,
  Brain,
  Radio,
  Zap,
  Activity,
  Link2,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

function NeuralOrb({ color, size = 220 }: { color: string; size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full blur-3xl"
      style={{ width: size, height: size, background: `radial-gradient(circle, ${color}55, transparent 70%)` }}
      animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.4, 0.75, 0.4] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function Shimmer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <motion.div
        className="absolute inset-y-0 -left-1/2 w-1/3"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }}
        animate={{ x: ["-50%", "350%"] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

function SignalBars({ color }: { color: string }) {
  return (
    <div className="flex items-end gap-0.5">
      {[6, 10, 8, 14, 11].map((h, i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full"
          style={{ background: color, height: h }}
          animate={{ scaleY: [0.4, 1, 0.6, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

export function SimpleReferrals({ profile }: { profile: AmbassadorProfile }) {
  const { shareUrl } = useReferralHandle();
  const stats = useReferralStats(profile.user_id);

  const insta = `🚀 Level up your prep with ACRY AI — India's smartest study app.\nUse my link: ${shareUrl}`;

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join ACRY AI", text: "Smarter studying starts here.", url: shareUrl });
      } catch {}
    } else {
      copy(shareUrl, "Link copied");
    }
  };

  // Conversion rate from real stats
  const conversionRate = stats.total > 0 ? Math.round((stats.conversions / stats.total) * 100) : 0;

  // Live "AI signal" pulse
  const [scan, setScan] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setScan((p) => (p + 1) % 100), 90);
    return () => clearInterval(i);
  }, []);

  // AI-generated insight tag
  const insight = useMemo(() => {
    if (stats.loading) return "Calibrating neural model…";
    if (stats.total === 0) return "Drop your link — AI will amplify reach automatically";
    if (conversionRate >= 50) return `Elite signal · ${conversionRate}% conversion rate detected`;
    if (stats.paid > 0) return `${stats.paid} paid · revenue stream active`;
    return `${stats.total} taps registered · momentum building`;
  }, [stats, conversionRate]);

  const channels = [
    { key: "wa", label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" />, color: T.green, onClick: () => window.open(`https://wa.me/?text=${encodeURIComponent(`Join ACRY AI 🚀 ${shareUrl}`)}`, "_blank") },
    { key: "tg", label: "Telegram", icon: <Send className="h-4 w-4" />, color: T.cyan, onClick: () => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`, "_blank") },
    { key: "ig", label: "Instagram", icon: <Instagram className="h-4 w-4" />, color: T.pink, onClick: () => copy(insta, "Instagram caption copied") },
    { key: "more", label: "More", icon: <Share2 className="h-4 w-4" />, color: T.purple, onClick: share },
  ];

  return (
    <div className="relative space-y-5">
      {/* === AI REFERRAL ENGINE HUD === */}
      <Card className="relative overflow-hidden !p-5">
        <div className="absolute -top-12 -left-10"><NeuralOrb color={T.purple} /></div>
        <div className="absolute -bottom-16 -right-10"><NeuralOrb color={T.cyan} size={260} /></div>
        <Shimmer />

        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="grid h-7 w-7 place-items-center rounded-lg"
                style={{ background: `linear-gradient(135deg, ${T.purple}, ${T.cyan})` }}
              >
                <Brain className="h-4 w-4 text-black" />
              </motion.div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.cyan }}>
                AI Referral Engine · Active
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight" style={{ color: T.text }}>
              Neural Share Network
            </div>
            <div className="mt-1 text-[11px]" style={{ color: T.mute }}>
              {insight}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ background: `${T.green}1f`, color: T.green, border: `1px solid ${T.green}40` }}
            >
              <Radio className="h-3 w-3" />
              BROADCASTING
            </div>
            <SignalBars color={T.cyan} />
            <div className="text-[10px] tabular-nums" style={{ color: T.mute }}>
              SCAN {String(scan).padStart(2, "0")}%
            </div>
          </div>
        </div>

        {/* Link bar */}
        <div className="relative mt-5">
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.mute }}>
            Quantum Share Link
          </div>
          <div
            className="mt-1.5 flex items-center justify-between rounded-xl px-3 py-2.5"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${T.cyan}33`,
              boxShadow: `inset 0 0 20px ${T.cyan}11`,
            }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0" style={{ color: T.cyan }} />
              <span className="truncate text-sm font-medium" style={{ color: T.text }}>
                {shareUrl}
              </span>
            </div>
            <button
              onClick={() => copy(shareUrl, "Link copied")}
              className="ml-2 shrink-0 rounded-lg p-1.5 transition-all hover:scale-110"
              style={{ background: `${T.purple}22` }}
              aria-label="Copy"
            >
              <Copy className="h-3.5 w-3.5" style={{ color: T.cyan }} />
            </button>
          </div>
        </div>

        {/* Conversion pulse */}
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          {[
            { lbl: "Taps", val: stats.total, c: T.cyan, i: <Users className="h-3 w-3" /> },
            { lbl: "Conv %", val: `${conversionRate}%`, c: T.purple, i: <Activity className="h-3 w-3" /> },
            { lbl: "Paid", val: stats.paid, c: T.green, i: <CheckCircle2 className="h-3 w-3" /> },
          ].map((s) => (
            <div
              key={s.lbl}
              className="rounded-xl border p-2.5"
              style={{ borderColor: `${s.c}33`, background: `linear-gradient(180deg, ${s.c}14, transparent)` }}
            >
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: s.c }}>
                {s.i}<span>{s.lbl}</span>
              </div>
              <div className="mt-1 text-base font-bold tabular-nums" style={{ color: T.text }}>
                {s.val}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* === CHANNEL BROADCAST GRID === */}
      <div>
        <SectionTitle
          title="Broadcast Channels"
          action={
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.cyan }}>
              <Cpu className="h-3 w-3" /> AI-optimized
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-2.5">
          {channels.map((ch, idx) => (
            <motion.button
              key={ch.key}
              onClick={ch.onClick}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.35 }}
              className="group relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all active:scale-[0.97]"
              style={{
                borderColor: `${ch.color}30`,
                background: `linear-gradient(135deg, ${ch.color}14, transparent 70%)`,
              }}
            >
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-50 transition-opacity group-hover:opacity-100"
                style={{ background: `${ch.color}55` }}
              />
              <div className="relative flex items-center justify-between">
                <div
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: `${ch.color}22`, color: ch.color, border: `1px solid ${ch.color}40` }}
                >
                  {ch.icon}
                </div>
                <Zap className="h-3 w-3" style={{ color: ch.color }} />
              </div>
              <div className="relative mt-2 text-sm font-bold" style={{ color: T.text }}>
                {ch.label}
              </div>
              <div className="relative text-[10px] uppercase tracking-wider" style={{ color: T.mute }}>
                Tap to broadcast
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* === EARNINGS HOLOGRAM === */}
      <Card className="relative overflow-hidden">
        <div className="absolute -top-10 right-0"><NeuralOrb color={T.green} size={180} /></div>
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.green }}>
              Vault Balance
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: T.text }}>
              ₹{stats.earnings.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: T.mute }}>
              Pending <span style={{ color: T.amber }}>₹{stats.pending.toLocaleString()}</span>
            </div>
          </div>
          <div className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: `linear-gradient(135deg, ${T.green}, ${T.cyan})` }}>
            <IndianRupee className="h-6 w-6 text-black" />
          </div>
        </div>
      </Card>

      {/* === LIVE FEED === */}
      <div>
        <SectionTitle
          title="Live Conversion Feed"
          action={
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.green }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: T.green }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: T.green }} />
              </span>
              Live
            </span>
          }
        />
        {stats.loading ? (
          <Card className="py-8 text-center">
            <div className="flex items-center justify-center gap-2 text-sm" style={{ color: T.mute }}>
              <Brain className="h-4 w-4 animate-pulse" style={{ color: T.purple }} />
              Scanning network…
            </div>
          </Card>
        ) : stats.recent.length === 0 ? (
          <Card className="py-8 text-center">
            <Sparkles className="mx-auto mb-2 h-5 w-5" style={{ color: T.cyan }} />
            <div className="text-sm" style={{ color: T.mute }}>
              No signals yet. Broadcast your link to ignite the network.
            </div>
          </Card>
        ) : (
          <div className="relative space-y-2">
            <div
              className="absolute left-[19px] top-2 bottom-2 w-px"
              style={{ background: `linear-gradient(180deg, ${T.purple}55, ${T.cyan}33, transparent)` }}
            />
            {stats.recent.map((r, idx) => {
              const name = r.referred_email?.split("@")[0] || "Student";
              const days = Math.max(
                0,
                Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86_400_000)
              );
              const status = r.is_paid ? "PAID" : r.converted ? "ACTIVE" : "JOINED";
              const color = r.is_paid ? T.green : r.converted ? T.cyan : T.amber;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                >
                  <Card className="relative !py-3 !pl-3 !pr-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div
                            className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold uppercase"
                            style={{
                              background: `linear-gradient(135deg, ${color}33, ${T.purple}33)`,
                              color: T.text,
                              border: `1px solid ${color}55`,
                            }}
                          >
                            {name.slice(0, 2)}
                          </div>
                          {r.is_paid && (
                            <div
                              className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full"
                              style={{ background: T.green, border: `2px solid ${T.bg}` }}
                            >
                              <CheckCircle2 className="h-2 w-2 text-black" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: T.text }}>
                            {name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: T.mute }}>
                            <Activity className="h-2.5 w-2.5" />
                            {days === 0 ? "Today" : `${days}d ago`}
                          </div>
                        </div>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider"
                        style={{ background: `${color}1f`, color, border: `1px solid ${color}40` }}
                      >
                        {status}
                      </span>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px]" style={{ color: T.mute }}>
        <Brain className="h-3 w-3" style={{ color: T.purple }} />
        <span>Powered by ACRY Neural Referral Engine · signals tracked in real time</span>
      </div>
    </div>
  );
}
