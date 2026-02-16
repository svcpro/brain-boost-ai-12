import { ExternalLink, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

const BILLING_LINKS = [
  {
    name: "Lovable",
    description: "App hosting, Cloud backend, Edge Functions",
    url: "https://lovable.dev/settings/billing",
    color: "from-purple-500/20 to-pink-500/10",
    icon: "💜",
  },
  {
    name: "Supabase",
    description: "Database, Auth, Storage, Realtime",
    url: "https://supabase.com/dashboard/org/_/billing",
    color: "from-emerald-500/20 to-green-500/10",
    icon: "⚡",
  },
  {
    name: "Resend",
    description: "Transactional & campaign emails",
    url: "https://resend.com/settings/billing",
    color: "from-blue-500/20 to-cyan-500/10",
    icon: "📧",
  },
  {
    name: "ElevenLabs",
    description: "AI voice generation, text-to-speech",
    url: "https://elevenlabs.io/subscription",
    color: "from-amber-500/20 to-yellow-500/10",
    icon: "🎙️",
  },
  {
    name: "Razorpay",
    description: "Payment gateway for subscriptions",
    url: "https://dashboard.razorpay.com/app/billing",
    color: "from-blue-600/20 to-indigo-500/10",
    icon: "💳",
  },
  {
    name: "Google AI (Gemini)",
    description: "Gemini models via Lovable AI Gateway",
    url: "https://aistudio.google.com/billing",
    color: "from-red-500/20 to-orange-500/10",
    icon: "🧠",
  },
  {
    name: "OpenAI (GPT)",
    description: "GPT models via Lovable AI Gateway",
    url: "https://platform.openai.com/settings/organization/billing/overview",
    color: "from-teal-500/20 to-green-400/10",
    icon: "🤖",
  },
  {
    name: "Web Push (VAPID)",
    description: "Push notifications — free, self-hosted VAPID keys",
    url: null,
    color: "from-pink-500/20 to-rose-500/10",
    icon: "🔔",
    note: "No billing — uses free VAPID protocol",
  },
  {
    name: "Vercel / Domain",
    description: "Custom domain & DNS (if applicable)",
    url: "https://vercel.com/dashboard",
    color: "from-gray-500/20 to-slate-500/10",
    icon: "🌐",
  },
];

const BillingLinksTab = () => {
  return (
    <div className="space-y-4 mt-4">
      <div className="glass rounded-xl p-4 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          Service Billing & Payment Links
        </h3>
        <p className="text-[10px] text-muted-foreground mb-4">
          Direct links to billing dashboards of all services powering ACRY.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BILLING_LINKS.map((service, i) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-xl border border-border p-4 bg-gradient-to-br ${service.color} hover:border-primary/40 transition-all`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{service.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{service.name}</p>
                    <p className="text-[10px] text-muted-foreground">{service.description}</p>
                  </div>
                </div>
              </div>

              {service.url ? (
                <a
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Billing Dashboard
                </a>
              ) : (
                <p className="mt-3 text-[10px] text-muted-foreground italic">{service.note}</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BillingLinksTab;
