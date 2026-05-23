import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { AmbCard, AMB } from "./ui/primitives";
import { getEarnedBadges } from "./badges";
import type { AmbassadorProfile } from "./useAmbassador";

export function BadgesSection({ profile }: { profile: AmbassadorProfile }) {
  const badges = getEarnedBadges(profile);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="space-y-5">
      {/* Hero stat */}
      <AmbCard className="flex items-center justify-between p-5" glow={AMB.amber}>
        <div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.cyan }}>Badge collection</div>
          <div className="mt-1 text-2xl font-black" style={{ color: AMB.text }}>
            {earnedCount} <span className="text-base" style={{ color: AMB.mute }}>/ {badges.length} earned</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: AMB.mute }}>Keep grinding to unlock the legendary tier.</div>
        </div>
        <div className="text-5xl">🏅</div>
      </AmbCard>

      {/* Badge grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {badges.map((b, i) => (
          <motion.div
            key={b.key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
          >
            <AmbCard
              className="flex flex-col items-center p-4 text-center transition-transform hover:scale-[1.02]"
              glow={b.earned ? b.color : undefined}
            >
              <div
                className="relative grid h-14 w-14 place-items-center rounded-2xl text-2xl"
                style={{
                  background: b.earned
                    ? `linear-gradient(135deg, ${b.color}40, ${b.color}10)`
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${b.earned ? b.color : AMB.border}`,
                  filter: b.earned ? `drop-shadow(0 0 12px ${b.color}80)` : "grayscale(1) opacity(0.45)",
                }}
              >
                {b.icon}
                {!b.earned && (
                  <div
                    className="absolute -right-1 -bottom-1 grid h-5 w-5 place-items-center rounded-full"
                    style={{ background: AMB.bg2, border: `1px solid ${AMB.border}` }}
                  >
                    <Lock className="h-2.5 w-2.5" style={{ color: AMB.mute }} />
                  </div>
                )}
              </div>

              <div
                className="mt-2 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest"
                style={{ background: `${b.color}22`, color: b.earned ? b.color : AMB.mute }}
              >
                {b.tier}
              </div>

              <div className="mt-1.5 text-xs font-bold leading-tight" style={{ color: AMB.text }}>{b.name}</div>
              <div className="mt-1 line-clamp-2 text-[10px] leading-snug" style={{ color: AMB.mute }}>{b.description}</div>
            </AmbCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
