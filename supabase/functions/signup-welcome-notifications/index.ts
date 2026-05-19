import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { user_id, email, display_name, event } = await req.json();
    // event: "signup" | "first_login"

    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: "user_id and email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userName = display_name || email.split("@")[0];
    const results: Record<string, any> = {};

    // ─── 1. WELCOME EMAIL via trigger-email ───
    try {
      const emailResp = await fetch(`${SUPABASE_URL}/functions/v1/trigger-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trigger_key: "user_signup",
          user_id,
          variables: { user_name: userName },
        }),
      });
      const emailResult = await emailResp.json();
      results.email = { status: emailResp.ok ? "sent" : "failed", ...emailResult };
      console.log("Email result:", JSON.stringify(results.email));
    } catch (e) {
      results.email = { status: "error", message: e instanceof Error ? e.message : "unknown" };
      console.error("Email error:", e);
    }


    // ─── 2. WHATSAPP WELCOME (recovery_trust template via MSG91) ───
    try {
      const MSG91_AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY");
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone, whatsapp_enabled, is_banned")
        .eq("id", user_id)
        .maybeSingle();

      const rawPhone = String(profile?.phone || "").replace(/\D/g, "");
      const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

      const { data: tpl } = await supabase
        .from("whatsapp_msg91_templates")
        .select("is_active")
        .eq("template_name", "recovery_trust")
        .maybeSingle();
      const tplActive = tpl?.is_active !== false;

      if (!MSG91_AUTH_KEY) {
        results.whatsapp = { status: "skipped", reason: "no_msg91_key" };
      } else if (!profile || profile.is_banned || profile.whatsapp_enabled === false) {
        results.whatsapp = { status: "skipped", reason: "not_eligible" };
      } else if (phone.length < 10) {
        results.whatsapp = { status: "skipped", reason: "no_phone" };
      } else if (!tplActive) {
        results.whatsapp = { status: "skipped", reason: "template_inactive" };
      } else {
        const firstName = (userName?.split(" ")[0] || "Champion").slice(0, 50);
        const waResp = await fetch(
          "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", authkey: MSG91_AUTH_KEY },
            body: JSON.stringify({
              integrated_number: "918796032562",
              content_type: "template",
              payload: {
                messaging_product: "whatsapp",
                type: "template",
                template: {
                  name: "recovery_trust",
                  language: { code: "en", policy: "deterministic" },
                  namespace: "5a93dcbd_6802_42d5_af95_17d4fd2d7441",
                  to_and_components: [{
                    to: [phone],
                    components: {
                      body_customer_name: {
                        type: "text",
                        value: firstName,
                        parameter_name: "customer_name",
                      },
                    },
                  }],
                },
              },
            }),
          },
        );
        const waOut = await waResp.json().catch(() => ({}));
        results.whatsapp = { status: waResp.ok ? "sent" : "failed", response: waOut };
        console.log("WhatsApp result:", JSON.stringify(results.whatsapp));
      }
    } catch (e) {
      results.whatsapp = { status: "error", message: e instanceof Error ? e.message : "unknown" };
      console.error("WhatsApp error:", e);
    }


    try {
      // Check if user has push subscription
      const { data: pushSubs } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .limit(1);

      if (pushSubs && pushSubs.length > 0) {
        const pushResp = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id,
            title: "🎉 Welcome to ACRY!",
            body: `Hi ${userName}! Your AI Second Brain is ready. Start studying smarter today!`,
            url: "https://acry.ai/app",
            tag: "welcome",
          }),
        });
        const pushResult = await pushResp.json();
        results.push = { status: pushResp.ok ? "sent" : "failed", ...pushResult };
        console.log("Push result:", JSON.stringify(results.push));
      } else {
        results.push = { status: "skipped", reason: "no_push_subscription_yet" };
      }
    } catch (e) {
      results.push = { status: "error", message: e instanceof Error ? e.message : "unknown" };
      console.error("Push error:", e);
    }

    // ─── 4. VOICE NOTIFICATION (enabled by default) ───
    try {
      // Voice is enabled by default for all users – check profile flag
      const { data: voiceProfile } = await supabase
        .from("profiles")
        .select("voice_notifications_enabled")
        .eq("id", user_id)
        .maybeSingle();

      // Default to true if no profile or column not set
      const voiceEnabled = voiceProfile?.voice_notifications_enabled !== false;

      if (voiceEnabled) {
        const voiceResp = await fetch(`${SUPABASE_URL}/functions/v1/voice-notification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "welcome",
            language: "en",
            tone: "soft",
            context: { userName },
          }),
        });
        const voiceResult = await voiceResp.json();
        results.voice = { status: voiceResp.ok ? "generated" : "failed", ...voiceResult };
        console.log("Voice result:", JSON.stringify(results.voice));
      } else {
        results.voice = { status: "skipped", reason: "voice_disabled_by_user" };
      }
    } catch (e) {
      results.voice = { status: "error", message: e instanceof Error ? e.message : "unknown" };
      console.error("Voice error:", e);
    }

    // ─── 5. VOICE BROADCAST (OBD/IVR welcome call) ───
    try {
      const { data: vbCfg } = await supabase
        .from("voice_broadcast_config")
        .select("is_enabled, signup_trigger_enabled")
        .maybeSingle();
      if (vbCfg?.is_enabled && vbCfg?.signup_trigger_enabled) {
        const vbResp = await fetch(`${SUPABASE_URL}/functions/v1/voice-broadcast`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "send_to_user", user_id, trigger_key: "signup" }),
        });
        const vbOut = await vbResp.json().catch(() => ({}));
        results.voice_broadcast = { status: vbResp.ok ? "queued" : "failed", ...vbOut };
      } else {
        results.voice_broadcast = { status: "skipped", reason: "trigger_disabled" };
      }
    } catch (e) {
      results.voice_broadcast = { status: "error", message: e instanceof Error ? e.message : "unknown" };
      console.error("Voice broadcast error:", e);
    }

    return new Response(JSON.stringify({ success: true, event, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("signup-welcome-notifications error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
