import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    // ─── 2. WHATSAPP via whatsapp-notify (Meta-approved templates) ───
    try {
      // Check if user has WhatsApp number in profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp_number, whatsapp_opted_in")
        .eq("id", user_id)
        .maybeSingle();

      if (profile?.whatsapp_number && profile?.whatsapp_opted_in === true) {
        const waResp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-notify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event_type: "signup",
            user_id,
            data: {
              name: userName,
              email,
              first_topic: "Your First Topic",
              community_count: "10,000",
            },
          }),
        });
        const waResult = await waResp.json();
        results.whatsapp = { status: waResp.ok ? "triggered" : "failed", ...waResult };
        console.log("WhatsApp result:", JSON.stringify(results.whatsapp));
      } else {
        results.whatsapp = { status: "skipped", reason: "no_whatsapp_number_or_not_opted_in" };
      }
    } catch (e) {
      results.whatsapp = { status: "error", message: e instanceof Error ? e.message : "unknown" };
      console.error("WhatsApp error:", e);
    }

    // ─── 3. PUSH NOTIFICATION (enabled by default) ───
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
