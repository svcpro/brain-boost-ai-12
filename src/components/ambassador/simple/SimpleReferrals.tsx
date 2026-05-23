import { Btn, Card, SectionTitle, Stat, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { useReferralHandle } from "@/hooks/useReferralHandle";
import { Copy, Share2, MessageCircle, Send, Instagram, Users, CheckCircle2, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export function SimpleReferrals({ profile }: { profile: AmbassadorProfile }) {
  const { shareUrl } = useReferralHandle();
  const refs = profile.points || 0;
  const paid = Math.floor(refs * 0.4);
  const active = refs - paid;

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
        <Stat label="Total" value={refs} icon={<Users className="h-3.5 w-3.5" />} color={T.cyan} />
        <Stat label="Active" value={active} icon={<Users className="h-3.5 w-3.5" />} color={T.purple} />
        <Stat label="Paid" value={paid} icon={<CheckCircle2 className="h-3.5 w-3.5" />} color={T.green} />
        <Stat label="Earned" value={`₹${(paid * 50).toLocaleString()}`} icon={<IndianRupee className="h-3.5 w-3.5" />} color={T.amber} />
      </div>

      {/* History */}
      <div>
        <SectionTitle title="Recent joins" />
        {refs === 0 ? (
          <Card className="py-8 text-center">
            <div className="text-sm" style={{ color: T.mute }}>
              No referrals yet. Share your link to get started 🚀
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: Math.min(5, refs) }).map((_, i) => (
              <Card key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold"
                    style={{ background: `${T.purple}33`, color: T.text }}
                  >
                    {String.fromCharCode(65 + (i % 26))}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: T.text }}>
                      Student {i + 1}
                    </div>
                    <div className="text-[11px]" style={{ color: T.mute }}>
                      Joined {i + 1}d ago
                    </div>
                  </div>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: i < paid ? `${T.green}22` : `${T.amber}22`,
                    color: i < paid ? T.green : T.amber,
                  }}
                >
                  {i < paid ? "Paid" : "Active"}
                </span>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
