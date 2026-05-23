import { Card, T } from "./ui";
import { MessageCircle, Send, Video, ArrowUpRight } from "lucide-react";

const LINKS = [
  {
    label: "WhatsApp Community",
    desc: "Connect with other ambassadors",
    icon: <MessageCircle className="h-5 w-5" />,
    color: "#25d366",
    url: "https://chat.whatsapp.com/",
  },
  {
    label: "Telegram Group",
    desc: "Announcements & resources",
    icon: <Send className="h-5 w-5" />,
    color: "#229ed9",
    url: "https://t.me/",
  },
  {
    label: "Weekly Meeting",
    desc: "Every Sunday · 7:00 PM IST",
    icon: <Video className="h-5 w-5" />,
    color: T.purple,
    url: "https://meet.google.com/",
  },
];

export function SimpleCommunity() {
  return (
    <div className="space-y-3">
      {LINKS.map((l) => (
        <Card key={l.label} onClick={() => window.open(l.url, "_blank")} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div
              className="grid h-11 w-11 place-items-center rounded-xl"
              style={{ background: `${l.color}22`, color: l.color }}
            >
              {l.icon}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: T.text }}>
                {l.label}
              </div>
              <div className="text-[11px]" style={{ color: T.mute }}>
                {l.desc}
              </div>
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4" style={{ color: T.mute }} />
        </Card>
      ))}
    </div>
  );
}
