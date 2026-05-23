import { Btn, Card, SectionTitle, Stat, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { useReferralHandle } from "@/hooks/useReferralHandle";
import { useReferralStats } from "./useReferralStats";
import { Copy, Share2, MessageCircle, Send, Instagram, Users, CheckCircle2, IndianRupee, TrendingUp, Sparkles } from "lucide-react";
import { toast } from "sonner";

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

  return (
    <div className="space-y-4">
      {/* Link card */}
      <Card glow={T.purple} className="p-5">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
          Your unique link
        </div>
        <div
          className="mt-2 flex items-center justify-between rounded-xl px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}` }}
        >
          <span className="truncate text-sm" style={{ color: T.cyan }}>
            {shareUrl}
          </span>
          <button onClick={() => copy(shareUrl, "Link copied")} className="ml-2 shrink-0" aria-label="Copy">
            <Copy className="h-4 w-4" style={{ color: T.mute }} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn
            variant="primary"
            onClick={() =>
              window.open(`https://wa.me/?text=${encodeURIComponent(`Join ACRY AI 🚀 ${shareUrl}`)}`, "_blank")
            }
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`, "_blank")}
          >
            <Send className="h-4 w-4" /> Telegram
          </Btn>
          <Btn variant="ghost" onClick={() => copy(insta, "Instagram caption copied")}>
            <Instagram className="h-4 w-4" /> Instagram
          </Btn>
          <Btn variant="ghost" onClick={share}>
            <Share2 className="h-4 w-4" /> More
          </Btn>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Total" value={stats.total} icon={<Users className="h-3.5 w-3.5" />} color={T.cyan} />
        <Stat label="Active" value={stats.active} icon={<Sparkles className="h-3.5 w-3.5" />} color={T.purple} />
        <Stat label="Paid" value={stats.paid} icon={<CheckCircle2 className="h-3.5 w-3.5" />} color={T.green} />
        <Stat label="Conversions" value={stats.conversions} icon={<TrendingUp className="h-3.5 w-3.5" />} color={T.amber} />
      </div>

      {/* Earnings strip */}
      <Card className="flex items-center justify-between p-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>Earned so far</div>
          <div className="mt-0.5 text-xl font-bold" style={{ color: T.text }}>
            ₹{stats.earnings.toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>Pending</div>
          <div className="mt-0.5 text-xl font-bold" style={{ color: T.amber }}>
            ₹{stats.pending.toLocaleString()}
          </div>
        </div>
        <IndianRupee className="h-5 w-5" style={{ color: T.green }} />
      </Card>

      {/* History */}
      <div>
        <SectionTitle title="Recent joins" />
        {stats.loading ? (
          <Card className="py-8 text-center">
            <div className="text-sm" style={{ color: T.mute }}>Loading…</div>
          </Card>
        ) : stats.recent.length === 0 ? (
          <Card className="py-8 text-center">
            <div className="text-sm" style={{ color: T.mute }}>
              No referrals yet. Share your link to get started 🚀
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.recent.map((r) => {
              const name = r.referred_email?.split("@")[0] || "Student";
              const days = Math.max(
                0,
                Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86_400_000)
              );
              const status = r.is_paid ? "Paid" : r.converted ? "Active" : "Joined";
              const color = r.is_paid ? T.green : r.converted ? T.cyan : T.amber;
              return (
                <Card key={r.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold uppercase"
                      style={{ background: `${T.purple}33`, color: T.text }}
                    >
                      {name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: T.text }}>
                        {name}
                      </div>
                      <div className="text-[11px]" style={{ color: T.mute }}>
                        {days === 0 ? "Today" : `${days}d ago`}
                      </div>
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${color}22`, color }}
                  >
                    {status}
                  </span>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
