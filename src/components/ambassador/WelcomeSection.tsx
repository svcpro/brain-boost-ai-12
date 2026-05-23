import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  AmbCard,
  AnimatedCounter,
  ProgressRing,
  AMB,
  getLevel,
  AI_LEVELS,
  LiveDot,
  HudCorners,
  NeonButton,
} from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";
import {
  Trophy,
  Zap,
  Flame,
  Users,
  Sparkles,
  Crown,
  Target,
  Rocket,
  Radar,
  Activity,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

export function WelcomeSection({ profile }: { profile: AmbassadorProfile }) {
  const level = useMemo(() => getLevel(profile.xp), [profile.xp]);
  const initials = (profile.full_name || profile.email).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      {/* ============ HERO — AI COMMAND BAY ============ */}
      <AmbCard className="relative p-5 sm:p-8" glow={AMB.cyan} hud>
        {/* plasma sun backdrop */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-50"
          style={{
            background: `radial-gradient(circle, ${AMB.cyan}55 0%, ${AMB.amber}22 40%, transparent 70%)`,
            filter: "blur(20px)",
          }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-40"
          style={{ background: `radial-gradient(circle, ${AMB.purple}55 0%, transparent 70%)`, filter: "blur(24px)" }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />

        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          {/* Identity block */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <LiveDot color={AMB.cyan} label="Live · Ambassador OS v2" />
              <span
                className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ borderColor: `${AMB.amber}55`, color: AMB.amber, background: `${AMB.amber}12` }}
              >
                {profile.ambassador_code || "AMB-XXX"}
              </span>
              <span
                className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
                style={{ borderColor: `${level.current.color}55`, color: level.current.color, background: `${level.current.color}14` }}
              >
                {level.current.icon} {level.current.name}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <motion.div
                  className="absolute -inset-1 rounded-2xl opacity-70"
                  style={{ background: `conic-gradient(from 0deg, ${AMB.cyan}, ${AMB.amber}, ${AMB.purple}, ${AMB.cyan})`, filter: "blur(6px)" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                />
                <div
                  className="relative grid h-20 w-20 place-items-center rounded-2xl text-2xl font-black"
                  style={{
                    background: `linear-gradient(135deg, ${AMB.cyan}, ${AMB.amber})`,
                    color: "#1a0726",
                    boxShadow: `0 8px 28px -8px ${AMB.cyan}`,
                  }}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    initials
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: AMB.mute }}>
                  Welcome back, Captain
                </div>
                <h1
                  className="mt-0.5 text-3xl font-bold leading-tight sm:text-4xl"
                  style={{ color: AMB.text, fontFamily: "'Space Grotesk', system-ui, sans-serif", letterSpacing: "-0.02em" }}
                >
                  {profile.full_name?.split(" ")[0] || "Ambassador"}
                </h1>
                <div className="mt-1 text-xs" style={{ color: AMB.mute }}>
                  {profile.college || "Your campus"} · {profile.city || "India"}
                </div>
              </div>
            </div>

            {/* Level progress bar */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: AMB.mute }}>
                <span className="font-semibold" style={{ color: level.current.color }}>
                  {level.current.icon} {level.current.name}
                </span>
                <span>
                  <AnimatedCounter value={profile.xp} />{" "}
                  {level.current !== level.next && (
                    <span style={{ color: AMB.mute }}>
                      / {level.next.min.toLocaleString()} XP →{" "}
                      <span style={{ color: level.next.color }}>{level.next.name}</span>
                    </span>
                  )}
                </span>
              </div>
              <div
                className="relative h-2.5 overflow-hidden rounded-full"
                style={{ background: "rgba(255,244,234,0.06)", border: `1px solid ${AMB.border}` }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${level.current.color}, ${level.next.color}, ${AMB.amber})`,
                    boxShadow: `0 0 14px ${level.current.color}aa`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${level.pct}%` }}
                  transition={{ duration: 1.3, ease: "easeOut" }}
                />
                {/* shimmer sweep */}
                <motion.div
                  className="absolute inset-y-0 w-20"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,244,234,0.5), transparent)" }}
                  animate={{ x: ["-100%", "1200%"] }}
                  transition={{ duration: 3.6, repeat: Infinity, ease: "linear" }}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <NeonButton variant="primary">
                <Rocket className="h-4 w-4" /> Launch Mission
              </NeonButton>
              <NeonButton variant="ghost">
                <Radar className="h-4 w-4" /> Scan Campus
              </NeonButton>
            </div>
          </div>

          {/* Right HUD — XP ring + meta */}
          <div className="flex items-center justify-center gap-5 lg:justify-end">
            <div className="flex flex-col items-center">
              <ProgressRing
                value={level.pct}
                size={150}
                stroke={11}
                color={AMB.cyan}
                glow={AMB.amber}
                label={
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      {level.pct}%
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>
                      to {level.next.name}
                    </span>
                  </div>
                }
              />
            </div>
            <div className="hidden flex-col gap-3 text-right sm:flex">
              <MetaPill icon={<Trophy className="h-3.5 w-3.5" />} label="Rank" value={profile.rank ?? "—"} color={AMB.amber} />
              <MetaPill icon={<Flame className="h-3.5 w-3.5" />} label="Streak" value={`${profile.streak_days}d`} color={AMB.pink} />
              <MetaPill icon={<Zap className="h-3.5 w-3.5" />} label="Weekly" value={profile.weekly_xp} color={AMB.cyan} />
            </div>
          </div>
        </div>
      </AmbCard>

      {/* ============ HUD STAT GRID ============ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<Trophy className="h-4 w-4" />} label="Global Rank" value={profile.rank ?? "—"} color={AMB.amber} />
        <StatTile icon={<Zap className="h-4 w-4" />} label="Plasma Points" value={profile.points} color={AMB.cyan} />
        <StatTile icon={<Flame className="h-4 w-4" />} label="Streak" value={`${profile.streak_days}d`} color={AMB.pink} />
        <StatTile icon={<Users className="h-4 w-4" />} label="Weekly XP" value={profile.weekly_xp} color={AMB.purple} />
      </div>

      {/* ============ BENTO GRID ============ */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Weekly performance — large */}
        <AmbCard className="relative p-5 lg:col-span-2" hud glow={AMB.cyan}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: AMB.cyan }} />
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>This week</div>
                <div className="text-sm font-bold" style={{ color: AMB.text }}>Performance Telemetry</div>
              </div>
            </div>
            <LiveDot color={AMB.amber} label="Realtime" />
          </div>

          {/* mini sparkline */}
          <Sparkline />

          <div className="mt-4 grid grid-cols-3 gap-3">
            <MicroStat label="Missions" value={0} color={AMB.cyan} />
            <MicroStat label="Referrals" value={0} color={AMB.amber} />
            <MicroStat label="Workshops" value={0} color={AMB.purple} />
          </div>
        </AmbCard>

        {/* Path to next level */}
        <AmbCard className="p-5" hud glow={AMB.amber}>
          <div className="mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4" style={{ color: AMB.amber }} />
            <div className="text-sm font-bold" style={{ color: AMB.text }}>
              Ascension Path
            </div>
          </div>
          <div className="space-y-1.5">
            {AI_LEVELS.map((lv) => {
              const reached = profile.xp >= lv.min;
              const isCurrent = lv.name === level.current.name;
              return (
                <div
                  key={lv.name}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all"
                  style={{
                    background: isCurrent
                      ? `linear-gradient(90deg, ${lv.color}26, transparent)`
                      : reached
                      ? `${lv.color}10`
                      : "rgba(255,244,234,0.02)",
                    border: `1px solid ${isCurrent ? `${lv.color}66` : reached ? `${lv.color}30` : "rgba(255,244,234,0.05)"}`,
                  }}
                >
                  <span className="flex items-center gap-1.5" style={{ color: reached ? lv.color : AMB.mute }}>
                    <span>{lv.icon}</span>
                    <span className="font-semibold">{lv.name}</span>
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: AMB.mute }}>
                    {lv.min.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </AmbCard>
      </div>

      {/* ============ CAMPUS IMPACT RADAR ============ */}
      <AmbCard className="relative p-5" hud glow={AMB.purple}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: AMB.purple }} />
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>
                Campus Operations
              </div>
              <div className="text-sm font-bold" style={{ color: AMB.text }}>Impact Radar</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: AMB.cyan }}>
            View report <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MicroStat label="Students impacted" value={0} color={AMB.emerald} />
          <MicroStat label="Active referrals" value={0} color={AMB.cyan} />
          <MicroStat label="Paid referrals" value={0} color={AMB.amber} />
          <MicroStat label="Posts shared" value={0} color={AMB.purple} />
        </div>
      </AmbCard>

      {/* ============ MISSION BRIEF ============ */}
      <AmbCard className="p-5" hud glow={AMB.pink}>
        <div className="flex items-start gap-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
            style={{ background: `linear-gradient(135deg, ${AMB.pink}, ${AMB.purple})`, boxShadow: `0 8px 20px -8px ${AMB.pink}` }}
          >
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: AMB.pink }}>
              Today's Directive
            </div>
            <div className="mt-0.5 text-base font-bold" style={{ color: AMB.text }}>
              Recruit 3 students to ACRY AI — earn 150 XP + Plasma Badge
            </div>
            <div className="mt-1 text-xs" style={{ color: AMB.mute }}>
              Share your ambassador link in your college WhatsApp groups. Every signup unlocks rewards.
            </div>
            <div className="mt-3">
              <NeonButton variant="primary">
                <Sparkles className="h-4 w-4" /> Accept directive
              </NeonButton>
            </div>
          </div>
        </div>
      </AmbCard>
    </div>
  );
}

/* ───────────────────── helpers ───────────────────── */

function MetaPill({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{ background: `${color}10`, border: `1px solid ${color}30` }}
    >
      <span style={{ color }}>{icon}</span>
      <div className="text-left">
        <div className="text-[9px] uppercase tracking-wider" style={{ color: AMB.mute }}>{label}</div>
        <div className="text-sm font-bold" style={{ color: AMB.text }}>
          {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <AmbCard className="relative p-4" glow={color} hud>
      <div className="flex items-center gap-2 text-[10px]" style={{ color: AMB.mute }}>
        <span style={{ color }}>{icon}</span>
        <span className="uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div
        className="mt-2 text-2xl font-black"
        style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
      </div>
      <div
        className="mt-1 h-0.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,244,234,0.06)" }}
      >
        <motion.div
          className="h-full"
          style={{ background: `linear-gradient(90deg, ${color}, transparent)`, boxShadow: `0 0 8px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: "70%" }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </AmbCard>
  );
}

function MicroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-3"
      style={{ background: `${color}10`, border: `1px solid ${color}26` }}
    >
      <HudCorners color={color} size={9} />
      <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: AMB.mute }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-black" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}>
        <AnimatedCounter value={value} />
      </div>
    </div>
  );
}

function Sparkline() {
  const points = [12, 18, 14, 22, 19, 28, 24, 34, 30, 42, 38, 50];
  const max = Math.max(...points);
  const w = 100, h = 28;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${(h - (p / max) * h).toFixed(2)}`)
    .join(" ");
  return (
    <div className="relative h-16 w-full">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="amb-spark" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={AMB.cyan} stopOpacity="0.5" />
            <stop offset="100%" stopColor={AMB.cyan} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#amb-spark)" />
        <motion.path
          d={path}
          fill="none"
          stroke={AMB.amber}
          strokeWidth={1.2}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${AMB.amber})` }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      </svg>
    </div>
  );
}
