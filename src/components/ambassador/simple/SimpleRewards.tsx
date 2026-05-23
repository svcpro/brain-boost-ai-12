import { Btn, Card, ProgressBar, SectionTitle, Stat, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { Award, Gift, IndianRupee, Lock, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const REWARDS = [
  { count: 10, title: "Certificate of Excellence", desc: "Official ACRY ambassador certificate", icon: "📜" },
  { count: 25, title: "ACRY Swag Kit", desc: "T-shirt, stickers, notebook", icon: "🎁" },
  { count: 50, title: "Premium Access (6 months)", desc: "Free Premium for you", icon: "⭐" },
  { count: 100, title: "Internship Opportunity", desc: "Fast-tracked ACRY internship", icon: "💼" },
  { count: 250, title: "Cash Bonus ₹25,000", desc: "Direct UPI transfer", icon: "💰" },
];

export function SimpleRewards({ profile }: { profile: AmbassadorProfile }) {
  const refs = profile.points || 0;
  const earned = Math.floor(refs * 0.4) * 50;
  const pending = (refs - Math.floor(refs * 0.4)) * 50;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Earned" value={`₹${earned.toLocaleString()}`} icon={<IndianRupee className="h-3.5 w-3.5" />} color={T.green} />
        <Stat label="Pending" value={`₹${pending.toLocaleString()}`} icon={<Gift className="h-3.5 w-3.5" />} color={T.amber} />
        <Stat label="Unlocked" value={REWARDS.filter((r) => refs >= r.count).length} icon={<Award className="h-3.5 w-3.5" />} color={T.purple} />
      </div>

      <SectionTitle title="Milestones" />
      <div className="space-y-3">
        {REWARDS.map((r) => {
          const unlocked = refs >= r.count;
          const pct = Math.min(100, (refs / r.count) * 100);
          return (
            <Card key={r.count} glow={unlocked ? T.green : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl"
                    style={{
                      background: unlocked ? `${T.green}22` : "rgba(255,255,255,0.05)",
                      border: `1px solid ${unlocked ? T.green : T.border}`,
                    }}
                  >
                    {unlocked ? <CheckCircle2 className="h-5 w-5" style={{ color: T.green }} /> : <span>{r.icon}</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: T.text }}>
                      {r.title}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: T.mute }}>
                      {r.desc}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold" style={{ color: unlocked ? T.green : T.mute }}>
                    {r.count}
                  </div>
                  <div className="text-[10px]" style={{ color: T.mute }}>
                    refs
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar value={Math.min(refs, r.count)} max={r.count} color={unlocked ? T.green : T.purple} />
                </div>
                {unlocked ? (
                  <Btn size="sm" variant="primary" onClick={() => toast.success("Reward claim request sent")}>
                    <Sparkles className="h-3.5 w-3.5" /> Claim
                  </Btn>
                ) : (
                  <Btn size="sm" variant="ghost" disabled>
                    <Lock className="h-3.5 w-3.5" /> Locked
                  </Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
