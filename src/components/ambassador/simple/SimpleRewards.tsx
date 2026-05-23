import { Btn, Card, SectionTitle, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { useReferralStats } from "./useReferralStats";
import {
  Award,
  Gift,
  IndianRupee,
  Lock,
  CheckCircle2,
  Sparkles,
  Zap,
  Brain,
  Cpu,
  Rocket,
  Shield,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type Reward = {
  count: number;
  title: string;
  desc: string;
  icon: React.ReactNode;
  tier: string;
  accent: string;
  payload: string;
};

const REWARDS: Reward[] = [
  { count: 10,  tier: "TIER 01", title: "Certificate of Excellence", desc: "Verified on-chain ambassador credential", icon: <Shield className="h-5 w-5" />,   accent: T.cyan,   payload: "Digital Badge" },
  { count: 25,  tier: "TIER 02", title: "ACRY Swag Drop",            desc: "Limited-edition kit · shipped to your door", icon: <Gift className="h-5 w-5" />,     accent: T.purple, payload: "Physical Kit" },
  { count: 50,  tier: "TIER 03", title: "Premium · 6 Months",        desc: "Full ACRY Premium unlocked instantly",       icon: <Sparkles className="h-5 w-5" />, accent: T.pink,   payload: "Auto-Activated" },
  { count: 100, tier: "TIER 04", title: "Internship Fast-Track",     desc: "Skip the queue · direct review by team",     icon: <Rocket className="h-5 w-5" />,   accent: T.amber,  payload: "Career Slot" },
  { count: 250, tier: "TIER 05", title: "₹25,000 Cash Bonus",        desc: "Instant UPI transfer · zero paperwork",       icon: <IndianRupee className="h-5 w-5" />, accent: T.green, payload: "Direct Payout" },
];

function NeuralOrb({ color, size = 220 }: { color: string; size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full blur-3xl"
      style={{ width: size, height: size, background: `radial-gradient(circle, ${color}55, transparent 70%)` }}
      animate={reduce ? undefined : { scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function Shimmer() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-y-0 -left-1/2 w-1/3"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }}
        animate={{ x: ["-50%", "350%"] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  );
}

function TierRing({ pct, color, locked }: { pct: number; color: string; locked: boolean }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <defs>
        <linearGradient id={`g-${color}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={T.cyan} />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="3" fill="none" />
      <motion.circle
        cx="28" cy="28" r={r}
        stroke={locked ? `url(#g-${color})` : T.green}
        strokeWidth="3" fill="none" strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * pct) / 100 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        transform="rotate(-90 28 28)"
      />
    </svg>
  );
}

export function SimpleRewards({ profile }: { profile: AmbassadorProfile }) {
  const stats = useReferralStats(profile.user_id);
  const refs = stats.total;
  const earned = stats.earnings;
  const pending = stats.pending;

  const unlocked = useMemo(() => REWARDS.filter((r) => refs >= r.count).length, [refs]);
  const nextReward = useMemo(() => REWARDS.find((r) => refs < r.count), [refs]);
  const nextPct = nextReward ? Math.min(100, (refs / nextReward.count) * 100) : 100;

  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setPulse((p) => (p + 1) % 100), 80);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="relative space-y-5">
      {/* AI Engine HUD */}
      <Card className="relative overflow-hidden !p-5">
        <div className="absolute -top-10 -left-10"><NeuralOrb color={T.purple} /></div>
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
                AI Reward Engine · Online
              </div>
            </div>
            <div className="mt-2 text-xl font-bold tracking-tight" style={{ color: T.text }}>
              Neural Rewards Vault
            </div>
            <div className="mt-1 text-[11px]" style={{ color: T.mute }}>
              Auto-syncing your referrals → milestone payouts in real time
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                 style={{ background: `${T.green}1f`, color: T.green, border: `1px solid ${T.green}40` }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: T.green }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: T.green }} />
              </span>
              LIVE
            </div>
            <div className="mt-2 text-[10px] tabular-nums" style={{ color: T.mute }}>
              SYNC {String(pulse).padStart(2, "0")}%
            </div>
          </div>
        </div>

        {/* Vault stats */}
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          {[
            { lbl: "Earned",   val: `₹${earned.toLocaleString()}`,  c: T.green,  i: <IndianRupee className="h-3 w-3" /> },
            { lbl: "Pending",  val: `₹${pending.toLocaleString()}`, c: T.amber,  i: <Zap className="h-3 w-3" /> },
            { lbl: "Unlocked", val: `${unlocked}/${REWARDS.length}`,  c: T.purple, i: <Award className="h-3 w-3" /> },
          ].map((s) => (
            <div key={s.lbl} className="rounded-xl border p-2.5"
                 style={{ borderColor: `${s.c}33`, background: `linear-gradient(180deg, ${s.c}14, transparent)` }}>
              <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: s.c }}>
                {s.i}<span>{s.lbl}</span>
              </div>
              <div className="mt-1 text-base font-bold tabular-nums" style={{ color: T.text }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Next milestone tracker */}
        {nextReward && (
          <div className="relative mt-4 rounded-xl border p-3"
               style={{ borderColor: T.border, background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold uppercase tracking-wider" style={{ color: T.mute }}>Next Drop</span>
              <span className="tabular-nums font-bold" style={{ color: T.cyan }}>
                {refs} / {nextReward.count} refs
              </span>
            </div>
            <div className="mt-2 text-sm font-semibold" style={{ color: T.text }}>{nextReward.title}</div>
            <div className="relative mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: `linear-gradient(90deg, ${T.purple}, ${T.cyan}, ${T.pink})`, backgroundSize: "200% 100%" }}
                initial={{ width: 0 }}
                animate={{ width: `${nextPct}%`, backgroundPosition: ["0% 0%", "200% 0%"] }}
                transition={{ width: { duration: 1.1, ease: "easeOut" }, backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" } }}
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: T.mute }}>
              <TrendingUp className="h-3 w-3" style={{ color: T.green }} />
              <span>{nextReward.count - refs} more referrals to unlock</span>
            </div>
          </div>
        )}
      </Card>

      {/* Holographic milestone stack */}
      <SectionTitle
        title="Reward Matrix"
        action={
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: T.cyan }}>
            <Cpu className="h-3 w-3" /> Auto-claim ready
          </span>
        }
      />

      <div className="relative space-y-3">
        {/* Vertical neural line */}
        <div
          className="absolute left-[27px] top-2 bottom-2 w-px"
          style={{ background: `linear-gradient(180deg, ${T.purple}55, ${T.cyan}33, transparent)` }}
        />

        {REWARDS.map((r, idx) => {
          const isUnlocked = refs >= r.count;
          const pct = Math.min(100, (refs / r.count) * 100);
          return (
            <motion.div
              key={r.count}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.4 }}
              className="relative pl-2"
            >
              <Card
                glow={isUnlocked ? r.accent : undefined}
                className="relative overflow-hidden"
              >
                {isUnlocked && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{ background: `radial-gradient(400px 120px at 0% 50%, ${r.accent}33, transparent 60%)` }}
                  />
                )}
                <div className="relative flex items-center gap-3">
                  <div className="relative">
                    <TierRing pct={pct} color={r.accent} locked={!isUnlocked} />
                    <div
                      className="absolute inset-0 grid place-items-center"
                      style={{ color: isUnlocked ? T.green : r.accent }}
                    >
                      {isUnlocked ? <CheckCircle2 className="h-5 w-5" /> : r.icon}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
                        style={{ background: `${r.accent}1f`, color: r.accent, border: `1px solid ${r.accent}40` }}
                      >
                        {r.tier}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: T.mute }}>
                        {r.payload}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold" style={{ color: T.text }}>
                      {r.title}
                    </div>
                    <div className="mt-0.5 truncate text-[11px]" style={{ color: T.mute }}>
                      {r.desc}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums" style={{ color: isUnlocked ? T.green : T.text }}>
                        {r.count}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: T.mute }}>refs</div>
                    </div>
                    {isUnlocked ? (
                      <Btn size="sm" variant="primary" onClick={() => toast.success(`Claim request sent · ${r.title}`)}>
                        <Sparkles className="h-3 w-3" /> Claim
                      </Btn>
                    ) : (
                      <Btn size="sm" variant="ghost" disabled>
                        <Lock className="h-3 w-3" /> {Math.round(pct)}%
                      </Btn>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px]" style={{ color: T.mute }}>
        <Brain className="h-3 w-3" style={{ color: T.purple }} />
        <span>Powered by ACRY Neural Reward Engine · payouts verified in real time</span>
      </div>
    </div>
  );
}
