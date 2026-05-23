import { motion } from "framer-motion";
import { useMemo } from "react";
import { AmbCard, AnimatedCounter, ProgressRing, AMB, getLevel, AI_LEVELS } from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";
import { Trophy, Zap, Flame, Users, Sparkles, Crown, Target } from "lucide-react";

export function WelcomeSection({ profile }: { profile: AmbassadorProfile }) {
  const level = useMemo(() => getLevel(profile.xp), [profile.xp]);
  const initials = (profile.full_name || profile.email).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5">
      {/* Hero greeting */}
      <AmbCard className="p-5 sm:p-7" glow={AMB.purple}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="relative grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold sm:h-20 sm:w-20 sm:text-2xl"
              style={{
                background: `linear-gradient(135deg, ${AMB.purple}, ${AMB.cyan})`,
                color: "#fff",
                boxShadow: `0 8px 28px -8px ${AMB.purple}`,
              }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                initials
              )}
              <motion.span
                className="absolute -bottom-1 -right-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: level.current.color, color: "#06070f" }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              >
                {level.current.icon}
              </motion.span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>
                Welcome back
              </div>
              <div className="text-xl font-bold sm:text-2xl" style={{ color: AMB.text }}>
                {profile.full_name?.split(" ")[0] || "Ambassador"}{" "}
                <span style={{ color: level.current.color }}>{level.current.icon}</span>
              </div>
              <div className="mt-1 text-xs" style={{ color: AMB.mute }}>
                {profile.college || "College"} • {profile.city || "City"} • {profile.ambassador_code || "ID"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <ProgressRing
              value={level.pct}
              size={96}
              stroke={9}
              color={level.current.color}
              glow={level.next.color}
              label={
                <div className="flex flex-col items-center">
                  <span className="text-base font-bold">{level.pct}%</span>
                </div>
              }
              sub={level.current.name}
            />
          </div>
        </div>

        {/* Level progress bar */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs" style={{ color: AMB.mute }}>
            <span className="font-medium" style={{ color: level.current.color }}>
              {level.current.name}
            </span>
            <span>
              <AnimatedCounter value={profile.xp} /> XP{" "}
              {level.current !== level.next && (
                <span style={{ color: AMB.mute }}>
                  / {level.next.min.toLocaleString()} → <span style={{ color: level.next.color }}>{level.next.name}</span>
                </span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${level.current.color}, ${level.next.color})`,
                boxShadow: `0 0 12px ${level.current.color}80`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${level.pct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </div>
      </AmbCard>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<Trophy className="h-4 w-4" />} label="Rank" value={profile.rank ?? "—"} color={AMB.amber} />
        <StatTile icon={<Zap className="h-4 w-4" />} label="Points" value={profile.points} color={AMB.cyan} />
        <StatTile icon={<Flame className="h-4 w-4" />} label="Streak" value={`${profile.streak_days}d`} color={AMB.pink} />
        <StatTile icon={<Users className="h-4 w-4" />} label="Weekly XP" value={profile.weekly_xp} color={AMB.purple} />
      </div>

      {/* Weekly summary + impact */}
      <div className="grid gap-3 lg:grid-cols-3">
        <AmbCard className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
                This week
              </div>
              <div className="text-base font-semibold" style={{ color: AMB.text }}>
                Weekly Performance
              </div>
            </div>
            <Sparkles className="h-4 w-4" style={{ color: AMB.cyan }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MicroStat label="Missions" value={0} color={AMB.purple} />
            <MicroStat label="Referrals" value={0} color={AMB.cyan} />
            <MicroStat label="Workshops" value={0} color={AMB.pink} />
          </div>
        </AmbCard>

        <AmbCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4" style={{ color: AMB.amber }} />
            <div className="text-sm font-semibold" style={{ color: AMB.text }}>
              Path to {level.next.name}
            </div>
          </div>
          <div className="space-y-2">
            {AI_LEVELS.map((lv) => {
              const reached = profile.xp >= lv.min;
              return (
                <div
                  key={lv.name}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: reached ? `${lv.color}14` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${reached ? `${lv.color}40` : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <span style={{ color: reached ? lv.color : AMB.mute }}>
                    {lv.icon} {lv.name}
                  </span>
                  <span style={{ color: AMB.mute }}>{lv.min.toLocaleString()} XP</span>
                </div>
              );
            })}
          </div>
        </AmbCard>
      </div>

      {/* Campus impact */}
      <AmbCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4" style={{ color: AMB.emerald }} />
          <div className="text-sm font-semibold" style={{ color: AMB.text }}>
            Campus Impact
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MicroStat label="Students impacted" value={0} color={AMB.emerald} />
          <MicroStat label="Active referrals" value={0} color={AMB.cyan} />
          <MicroStat label="Paid referrals" value={0} color={AMB.amber} />
          <MicroStat label="Posts shared" value={0} color={AMB.purple} />
        </div>
      </AmbCard>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <AmbCard className="p-4" glow={color}>
      <div className="flex items-center gap-2 text-xs" style={{ color: AMB.mute }}>
        <span style={{ color }}>{icon}</span>
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold" style={{ color: AMB.text }}>
        {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
      </div>
    </AmbCard>
  );
}

function MicroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: `${color}10`,
        border: `1px solid ${color}26`,
      }}
    >
      <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-bold" style={{ color: AMB.text }}>
        <AnimatedCounter value={value} />
      </div>
    </div>
  );
}
