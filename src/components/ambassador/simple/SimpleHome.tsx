import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Btn, Card, Counter, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import {
  Share2,
  Users,
  Wallet,
  Gift,
  Trophy,
  ArrowRight,
  Copy,
  Brain,
  Sparkles,
  Zap,
  TrendingUp,
  Activity,
  Radio,
  Target,
  Rocket,
  ChevronRight,
} from "lucide-react";
import { useReferralHandle } from "@/hooks/useReferralHandle";
import { useReferralStats } from "./useReferralStats";
import { toast } from "sonner";

const MILESTONES = [
  { count: 10, reward: "Certificate" },
  { count: 25, reward: "ACRY Swag Kit" },
  { count: 50, reward: "Premium Access" },
  { count: 100, reward: "Internship" },
  { count: 250, reward: "₹25,000 Cash" },
];

function NeuralOrb({ color, className, delay = 0 }: { color: string; className?: string; delay?: number }) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background: color }}
      animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.65, 0.4] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ background: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function SimpleHome({
  profile,
  onGo,
}: {
  profile: AmbassadorProfile;
  onGo: (key: string) => void;
}) {
  const { shareUrl } = useReferralHandle();
  const stats = useReferralStats(profile.user_id);
  const refs = stats.total;

  const next = useMemo(
    () => MILESTONES.find((m) => refs < m.count) ?? MILESTONES[MILESTONES.length - 1],
    [refs]
  );
  const prev = useMemo(() => {
    const idx = MILESTONES.findIndex((m) => m === next);
    return idx > 0 ? MILESTONES[idx - 1].count : 0;
  }, [next]);
  const toGo = Math.max(0, next.count - refs);
  const pct = Math.max(0, Math.min(100, ((refs - prev) / Math.max(1, next.count - prev)) * 100));

  const [scan, setScan] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setScan((s) => (s + 1) % 100), 60);
    return () => clearInterval(id);
  }, []);

  const insight = useMemo(() => {
    if (stats.paid >= 5) return "Elite signal · Top 5% ambassador trajectory";
    if (refs >= 10) return "Momentum locked · Conversion engine active";
    if (refs >= 3) return "Signal rising · AI scaling your outreach";
    return "Booting neural network · Share to activate";
  }, [refs, stats.paid]);

  const copy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Neural link copied");
  };

  return (
    <div className="space-y-4">
      {/* AI HUD HERO */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border p-5"
        style={{
          background: `linear-gradient(135deg, ${T.bg2} 0%, ${T.bg} 100%)`,
          borderColor: T.borderHi,
          boxShadow: `0 20px 60px -20px ${T.purple}55, inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
      >
        <NeuralOrb color={`${T.purple}55`} className="-top-16 -left-16 h-48 w-48" />
        <NeuralOrb color={`${T.cyan}44`} className="-bottom-20 -right-16 h-56 w-56" delay={2} />

        {/* Live status bar */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              className="grid h-7 w-7 place-items-center rounded-lg"
              style={{ background: `${T.purple}22`, border: `1px solid ${T.purple}55` }}
            >
              <Brain className="h-3.5 w-3.5" style={{ color: T.purple }} />
            </motion.div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: T.mute }}>
                Ambassador Neural Core
              </div>
              <div className="text-[11px] font-semibold" style={{ color: T.cyan }}>
                v4.2 · Live
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: `${T.green}15`, border: `1px solid ${T.green}40` }}
          >
            <PulseDot color={T.green} />
            <span className="text-[10px] font-bold tracking-wider" style={{ color: T.green }}>
              ONLINE
            </span>
          </div>
        </div>

        {/* Greeting */}
        <div className="relative mt-4">
          <div className="text-[11px]" style={{ color: T.mute }}>
            Welcome back, agent
          </div>
          <h1 className="mt-0.5 text-3xl font-black tracking-tight" style={{ color: T.text }}>
            {profile.full_name?.split(" ")[0] || "Ambassador"}
            <span
              className="ml-2 inline-block bg-gradient-to-r bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${T.cyan}, ${T.purple})` }}
            >
              ◆
            </span>
          </h1>
          <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: T.mute }}>
            <Radio className="h-3 w-3" style={{ color: T.cyan }} />
            <span>
              {profile.college || "Your campus"}
              {profile.city ? ` · ${profile.city}` : ""}
            </span>
          </div>
        </div>

        {/* AI Insight */}
        <div
          className="relative mt-4 flex items-start gap-2 rounded-xl p-3"
          style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${T.border}` }}
        >
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: T.amber }} />
          <div className="text-[11px] leading-relaxed" style={{ color: T.text }}>
            {insight}
          </div>
        </div>

        {/* Neural link */}
        <div
          className="relative mt-3 flex items-center gap-2 overflow-hidden rounded-xl p-2.5"
          style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${T.cyan}33` }}
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${T.cyan}22` }}>
            <Zap className="h-3.5 w-3.5" style={{ color: T.cyan }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold" style={{ color: T.cyan }}>
              {shareUrl.replace(/^https?:\/\//, "")}
            </div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: T.mute }}>
              Quantum referral channel · {scan}%
            </div>
          </div>
          <button
            onClick={copy}
            className="grid h-8 w-8 place-items-center rounded-lg active:scale-95"
            style={{ background: `linear-gradient(135deg, ${T.purple}, ${T.cyan})` }}
          >
            <Copy className="h-3.5 w-3.5" style={{ color: "#0a0a0a" }} />
          </button>
        </div>

        {/* Quick share */}
        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <Btn
            variant="secondary"
            size="sm"
            onClick={() =>
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`Join ACRY AI with my link 🚀 ${shareUrl}`)}`,
                "_blank"
              )
            }
          >
            WhatsApp
          </Btn>
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`, "_blank")}
          >
            Telegram
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => onGo("referrals")}>
            <Share2 className="h-3.5 w-3.5" />
            More
          </Btn>
        </div>
      </motion.div>

      {/* LIVE METRICS GRID */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          icon={<Users className="h-3.5 w-3.5" />}
          label="Referrals"
          value={refs}
          color={T.cyan}
          delay={0}
        />
        <MetricCard
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Earnings"
          value={`₹${stats.earnings.toLocaleString()}`}
          color={T.green}
          delay={0.05}
        />
        <MetricCard
          icon={<Gift className="h-3.5 w-3.5" />}
          label="Pending"
          value={`₹${stats.pending.toLocaleString()}`}
          color={T.amber}
          delay={0.1}
        />
        <MetricCard
          icon={<Trophy className="h-3.5 w-3.5" />}
          label="Rank"
          value={profile.rank ?? "—"}
          color={T.pink}
          delay={0.15}
        />
      </div>

      {/* MILESTONE TRACKER */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-2xl border p-4"
        style={{
          background: `linear-gradient(135deg, ${T.purple}11, ${T.cyan}08)`,
          borderColor: T.border,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{ background: `${T.purple}22`, border: `1px solid ${T.purple}44` }}
            >
              <Target className="h-4 w-4" style={{ color: T.purple }} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: T.mute }}>
                Next neural unlock
              </div>
              <div className="text-sm font-bold" style={{ color: T.text }}>
                {next.reward}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black" style={{ color: T.cyan }}>
              {refs}
              <span className="text-sm" style={{ color: T.mute }}>
                /{next.count}
              </span>
            </div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: T.mute }}>
              <Counter value={toGo} /> to go
            </div>
          </div>
        </div>

        {/* Animated progress */}
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.4)" }}>
          <motion.div
            className="relative h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              background: `linear-gradient(90deg, ${T.purple}, ${T.cyan}, ${T.pink})`,
              backgroundSize: "200% 100%",
              boxShadow: `0 0 12px ${T.cyan}88`,
            }}
          >
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`,
                backgroundSize: "50% 100%",
              }}
            />
          </motion.div>
        </div>

        {/* Milestone dots */}
        <div className="mt-3 flex items-center justify-between">
          {MILESTONES.map((m, i) => {
            const hit = refs >= m.count;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="h-2 w-2 rounded-full transition-all"
                  style={{
                    background: hit ? T.cyan : "rgba(255,255,255,0.15)",
                    boxShadow: hit ? `0 0 8px ${T.cyan}` : undefined,
                  }}
                />
                <span className="text-[9px]" style={{ color: hit ? T.cyan : T.mute }}>
                  {m.count}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* COMMAND ACTIONS */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" style={{ color: T.purple }} />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: T.mute }}>
            Command Modules
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <CommandTile
            icon={<Rocket className="h-4 w-4" />}
            label="Share Link"
            hint="Neural broadcast"
            color={T.cyan}
            onClick={() => onGo("referrals")}
            delay={0}
          />
          <CommandTile
            icon={<Gift className="h-4 w-4" />}
            label="Rewards"
            hint="Unlock tiers"
            color={T.amber}
            onClick={() => onGo("rewards")}
            delay={0.05}
          />
          <CommandTile
            icon={<Target className="h-4 w-4" />}
            label="AI Tasks"
            hint="Auto-assigned"
            color={T.purple}
            onClick={() => onGo("tasks")}
            delay={0.1}
          />
          <CommandTile
            icon={<Trophy className="h-4 w-4" />}
            label="Leaderboard"
            hint="Top ambassadors"
            color={T.pink}
            onClick={() => onGo("leaderboard")}
            delay={0.15}
          />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative overflow-hidden rounded-2xl border p-3.5"
      style={{
        background: T.surface,
        borderColor: T.border,
      }}
    >
      <div
        className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full blur-2xl"
        style={{ background: `${color}33` }}
      />
      <div className="relative flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: T.mute }}>
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="relative mt-1.5 text-2xl font-black tracking-tight" style={{ color: T.text }}>
        {typeof value === "number" ? <Counter value={value} /> : value}
      </div>
      <div className="relative mt-1 flex items-center gap-1 text-[9px]" style={{ color }}>
        <TrendingUp className="h-2.5 w-2.5" />
        <span>live</span>
      </div>
    </motion.div>
  );
}

function CommandTile({
  icon,
  label,
  hint,
  color,
  onClick,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  color: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border p-3.5 text-left active:scale-[0.98]"
      style={{ background: T.surface, borderColor: T.border }}
    >
      <div
        className="pointer-events-none absolute -bottom-10 -right-10 h-24 w-24 rounded-full blur-2xl transition-opacity group-hover:opacity-100"
        style={{ background: `${color}33`, opacity: 0.5 }}
      />
      <div className="relative flex items-start justify-between">
        <div
          className="grid h-9 w-9 place-items-center rounded-xl"
          style={{ background: `${color}1a`, border: `1px solid ${color}33`, color }}
        >
          {icon}
        </div>
        <ChevronRight className="h-3.5 w-3.5" style={{ color: T.mute }} />
      </div>
      <div className="relative mt-2.5 text-sm font-bold" style={{ color: T.text }}>
        {label}
      </div>
      <div className="relative mt-0.5 text-[10px]" style={{ color: T.mute }}>
        {hint}
      </div>
    </motion.button>
  );
}
