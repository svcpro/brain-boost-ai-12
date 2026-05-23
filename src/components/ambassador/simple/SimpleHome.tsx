import { useMemo } from "react";
import { Btn, Card, Counter, ProgressBar, SectionTitle, Stat, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { Share2, Users, Wallet, Gift, Trophy, ArrowRight, Copy } from "lucide-react";
import { useReferralHandle } from "@/hooks/useReferralHandle";
import { useReferralStats } from "./useReferralStats";
import { toast } from "sonner";

const MILESTONES = [
  { count: 10, reward: "Certificate" },
  { count: 25, reward: "ACRY Swag Kit" },
  { count: 50, reward: "Premium Access" },
  { count: 100, reward: "Internship Opportunity" },
];

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

  const next = useMemo(() => MILESTONES.find((m) => refs < m.count) ?? MILESTONES[MILESTONES.length - 1], [refs]);
  const prev = useMemo(() => {
    const idx = MILESTONES.findIndex((m) => m === next);
    return idx > 0 ? MILESTONES[idx - 1].count : 0;
  }, [next]);
  const toGo = Math.max(0, next.count - refs);

  const copy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Referral link copied");
  };

  return (
    <div className="space-y-4">
      {/* Welcome */}
      <div>
        <div className="text-xs" style={{ color: T.mute }}>
          Welcome back 👋
        </div>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight" style={{ color: T.text }}>
          {profile.full_name?.split(" ")[0] || "Ambassador"}
        </h1>
        <div className="mt-0.5 text-xs" style={{ color: T.mute }}>
          {profile.college || "Your campus"} {profile.city ? `· ${profile.city}` : ""}
        </div>
      </div>

      {/* Hero referral card */}
      <Card glow={T.purple} className="overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
              Your referral link
            </div>
            <div className="mt-1 truncate text-sm font-semibold" style={{ color: T.cyan }}>
              {shareUrl.replace(/^https?:\/\//, "")}
            </div>
          </div>
          <Btn variant="primary" onClick={copy}>
            <Copy className="h-4 w-4" /> Copy
          </Btn>
        </div>
        <div className="mt-4 flex gap-2">
          <Btn
            variant="secondary"
            className="flex-1"
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
            className="flex-1"
            onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`, "_blank")}
          >
            Telegram
          </Btn>
          <Btn variant="ghost" onClick={() => onGo("referrals")}>
            <Share2 className="h-4 w-4" />
          </Btn>
        </div>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Referrals" value={refs} icon={<Users className="h-3.5 w-3.5" />} color={T.cyan} />
        <Stat label="Earnings" value={`₹${stats.earnings.toLocaleString()}`} icon={<Wallet className="h-3.5 w-3.5" />} color={T.green} />
        <Stat label="Pending" value={`₹${stats.pending.toLocaleString()}`} icon={<Gift className="h-3.5 w-3.5" />} color={T.amber} />
        <Stat label="Rank" value={profile.rank ?? "—"} icon={<Trophy className="h-3.5 w-3.5" />} color={T.pink} />
      </div>

      {/* Next reward progress */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
              Next reward
            </div>
            <div className="mt-0.5 text-base font-semibold" style={{ color: T.text }}>
              {next.reward}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: T.mute }}>
              <Counter value={toGo} /> referrals away
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold" style={{ color: T.cyan }}>
              {refs}/{next.count}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: T.mute }}>
              refs
            </div>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={Math.max(0, refs - prev)} max={Math.max(1, next.count - prev)} />
          <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: T.mute }}>
            <span>{prev}</span>
            <span>{next.count} referrals</span>
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <SectionTitle title="Quick actions" />
      <div className="grid grid-cols-2 gap-3">
        <QuickAction label="Share link" hint="WhatsApp first" color={T.cyan} onClick={() => onGo("referrals")} />
        <QuickAction label="See rewards" hint="Unlock perks" color={T.amber} onClick={() => onGo("rewards")} />
        <QuickAction label="Weekly tasks" hint="Earn faster" color={T.purple} onClick={() => onGo("tasks")} />
        <QuickAction label="Leaderboard" hint="Climb up" color={T.pink} onClick={() => onGo("leaderboard")} />
      </div>
    </div>
  );
}

function QuickAction({
  label,
  hint,
  color,
  onClick,
}: {
  label: string;
  hint: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <Card onClick={onClick} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold" style={{ color: T.text }}>
            {label}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: T.mute }}>
            {hint}
          </div>
        </div>
        <div
          className="grid h-8 w-8 place-items-center rounded-full"
          style={{ background: `${color}22`, color }}
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
