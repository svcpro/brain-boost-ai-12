import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Gift, Lock, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AmbCard, AMB, NeonButton, ProgressRing } from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  unlock_xp: number;
  tier: string;
  reward_type: string;
  is_active: boolean;
};

type Claim = { id: string; reward_id: string; status: string; created_at: string };

const TIER_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#cbd5e1",
  gold: AMB.amber,
  platinum: "#22d3ee",
  diamond: "#a78bfa",
};

export function RewardsSection({ profile }: { profile: AmbassadorProfile }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from("ambassador_rewards" as any).select("*").eq("is_active", true).order("unlock_xp", { ascending: true }),
      supabase.from("ambassador_reward_claims" as any).select("*").eq("user_id", profile.user_id),
    ]);
    setRewards((r as any) ?? []);
    setClaims((c as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile.user_id]);

  const claimedSet = useMemo(() => new Set(claims.map((c) => c.reward_id)), [claims]);

  const claim = async (reward: Reward) => {
    setClaiming(reward.id);
    const { error } = await supabase.from("ambassador_reward_claims" as any).insert({
      reward_id: reward.id,
      ambassador_id: profile.id,
      user_id: profile.user_id,
      status: "claimed",
    });
    setClaiming(null);
    if (error) return toast.error(error.message);
    toast.success(`Claimed: ${reward.title}`);
    load();
  };

  if (loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: AMB.cyan }} /></div>;
  }

  const nextLocked = rewards.find((r) => r.unlock_xp > profile.xp);

  return (
    <div className="space-y-5">
      {/* Next reward progress */}
      {nextLocked && (
        <AmbCard className="flex items-center gap-5 p-5" glow={TIER_COLORS[nextLocked.tier]}>
          <ProgressRing
            value={profile.xp}
            max={nextLocked.unlock_xp}
            size={90}
            stroke={8}
            label={<span className="text-base font-black">{Math.round((profile.xp / nextLocked.unlock_xp) * 100)}%</span>}
            sub="next"
            color={TIER_COLORS[nextLocked.tier]}
            glow={AMB.purple}
          />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.cyan }}>Next unlock</div>
            <div className="text-lg font-bold" style={{ color: AMB.text }}>
              {nextLocked.icon} {nextLocked.title}
            </div>
            <div className="mt-1 text-xs" style={{ color: AMB.mute }}>
              {(nextLocked.unlock_xp - profile.xp).toLocaleString()} XP to go
            </div>
          </div>
        </AmbCard>
      )}

      {/* Reward grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r, i) => {
          const unlocked = profile.xp >= r.unlock_xp;
          const claimed = claimedSet.has(r.id);
          const tierColor = TIER_COLORS[r.tier] ?? AMB.purple;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <AmbCard
                className="flex h-full flex-col items-center p-5 text-center"
                glow={unlocked ? tierColor : undefined}
              >
                <div
                  className="relative grid h-16 w-16 place-items-center rounded-2xl text-3xl"
                  style={{
                    background: unlocked ? `linear-gradient(135deg, ${tierColor}40, ${tierColor}10)` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${unlocked ? tierColor : AMB.border}`,
                    filter: unlocked ? "none" : "grayscale(1) opacity(0.5)",
                  }}
                >
                  {r.icon ?? "🎁"}
                  {!unlocked && (
                    <div className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full" style={{ background: AMB.bg2, border: `1px solid ${AMB.border}` }}>
                      <Lock className="h-3 w-3" style={{ color: AMB.mute }} />
                    </div>
                  )}
                </div>

                <div
                  className="mt-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: `${tierColor}22`, color: tierColor }}
                >
                  {r.tier}
                </div>

                <div className="mt-2 text-sm font-bold" style={{ color: AMB.text }}>{r.title}</div>
                <div className="mt-1 line-clamp-2 text-xs" style={{ color: AMB.mute }}>{r.description}</div>

                <div className="mt-3 text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
                  {r.unlock_xp.toLocaleString()} XP
                </div>

                <div className="mt-3 w-full">
                  {claimed ? (
                    <span className="inline-flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold" style={{ background: `${AMB.emerald}22`, color: AMB.emerald }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Claimed
                    </span>
                  ) : unlocked ? (
                    <NeonButton onClick={() => claim(r)} disabled={claiming === r.id} className="w-full !py-2 !text-xs">
                      <Gift className="h-3.5 w-3.5" />
                      {claiming === r.id ? "Claiming…" : "Claim now"}
                    </NeonButton>
                  ) : (
                    <span className="inline-flex w-full items-center justify-center gap-1 rounded-xl border py-2 text-xs" style={{ borderColor: AMB.border, color: AMB.mute }}>
                      <Sparkles className="h-3.5 w-3.5" /> Locked
                    </span>
                  )}
                </div>
              </AmbCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
