// trial-reminder-engine — runs once a day, sends contextual reminders to users
// during their free trial and right after it ends.
//
// Channels (best-effort, fire-and-forget):
//   - Push (send-push-notification)
//   - Email (send-transactional-email)
//   - SMS  (sms-event-engine, event_type: trial_ending / trial_expired)
//
// Cadence:
//   - Every day when 1–5 days remain → daily "trial ending" SMS/Push/Email
//   - Day 0 (expiry day)             → "Trial ended — renew now"
//   - +1 day / +3 days after expiry  → win-back follow-ups
//
// Idempotent per day: once the user renews (is_trial=false), they drop out automatically.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Pull all trial subscriptions whose trial_end_date is within [-3 days, +7 days]
    const lower = new Date(Date.now() - 3 * 86400000).toISOString();
    const upper = new Date(Date.now() + 7 * 86400000).toISOString();

    const { data: subs, error } = await sb
      .from("user_subscriptions")
      .select("user_id, trial_start_date, trial_end_date, is_trial, status")
      .eq("is_trial", true)
      .eq("status", "active")
      .gte("trial_end_date", lower)
      .lte("trial_end_date", upper);

    if (error) throw error;
    if (!subs?.length) {
      return json({ ok: true, processed: 0 });
    }

    let sent = 0;
    const renewUrl = "https://acry.ai/app?tab=you&section=subscription";

    for (const sub of subs) {
      try {
        const end = new Date(sub.trial_end_date!).getTime();
        const now = Date.now();
        const diffDays = Math.ceil((end - now) / 86400000);

        // Decide whether today is a reminder day
        let phase: "ending_soon" | "last_day" | "expired_today" | "expired_followup" | null = null;
        if (diffDays === 2) phase = "ending_soon";
        else if (diffDays === 1) phase = "last_day";
        else if (diffDays === 0) phase = "expired_today";
        else if (diffDays === -1 || diffDays === -3) phase = "expired_followup";
        if (!phase) continue;

        const { data: profile } = await sb
          .from("profiles")
          .select("id, display_name, email, phone")
          .eq("id", sub.user_id)
          .maybeSingle();

        if (!profile) continue;

        const name = profile.display_name?.split(" ")?.[0] || "there";

        const COPY: Record<string, { title: string; body: string; sms_event: string }> = {
          ending_soon: {
            title: `${name}, 2 days left in your free trial ⏳`,
            body: "Lock in Premium now to keep your AI brain, predictions and study plans.",
            sms_event: "trial_reminder",
          },
          last_day: {
            title: `Last day, ${name}! 🚨`,
            body: "Your free trial ends tomorrow — upgrade now to avoid losing access.",
            sms_event: "trial_reminder",
          },
          expired_today: {
            title: "Your free trial has ended 💔",
            body: "Renew now to keep your progress, predictions and AI features active.",
            sms_event: "trial_expired",
          },
          expired_followup: {
            title: `${name}, your brain misses you 🧠`,
            body: "Don't lose all your study progress — reactivate Premium in one tap.",
            sms_event: "trial_expired",
          },
        };
        const c = COPY[phase];

        // 1. Push (non-blocking)
        sb.functions
          .invoke("send-push-notification", {
            body: {
              recipient_id: profile.id,
              title: c.title,
              body: c.body,
              data: { type: "trial_reminder", phase, url: renewUrl },
            },
          })
          .catch(() => {});

        // 2. Email (non-blocking)
        if (profile.email) {
          sb.functions
            .invoke("send-transactional-email", {
              body: {
                to: profile.email,
                subject: c.title,
                heading: c.title,
                body_html: `<p>Hi ${name},</p><p>${c.body}</p><p><a href="${renewUrl}" style="display:inline-block;background:#7C4DFF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Renew Premium</a></p>`,
                cta_url: renewUrl,
                cta_label: "Renew Premium",
              },
            })
            .catch(() => {});
        }

        // 3. SMS (non-blocking)
        if (profile.phone) {
          sb.functions
            .invoke("sms-event-engine", {
              body: {
                event_type: c.sms_event,
                user_id: profile.id,
                data: {
                  name,
                  days: Math.max(0, diffDays),
                  link: renewUrl,
                  url: renewUrl,
                  time: new Date().toISOString().slice(11, 16),
                },
              },
            })
            .catch(() => {});
        }

        sent++;
      } catch (e) {
        console.warn("trial reminder failed for", sub.user_id, e);
      }
    }

    return json({ ok: true, processed: subs.length, sent });
  } catch (e) {
    console.error("trial-reminder-engine error", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
