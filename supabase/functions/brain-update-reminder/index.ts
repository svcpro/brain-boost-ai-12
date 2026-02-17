import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchWhatsApp } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find users who haven't updated brain in 24h (or never)
    const { data: staleUsers, error } = await supabase
      .from("profiles")
      .select("id, display_name, last_brain_update_at, push_notification_prefs")
      .or(`last_brain_update_at.is.null,last_brain_update_at.lt.${cutoff}`);

    if (error) throw error;
    if (!staleUsers?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const user of staleUsers) {
      // Check opt-out preference
      const prefs = user.push_notification_prefs as Record<string, boolean> | null;
      if (prefs?.brainUpdateReminders === false) continue;
      // Check if user has push subscriptions
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!subs?.length) continue;

      // Send push via the existing send-push-notification function
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            recipient_id: user.id,
            title: "🧠 Your Brain Needs an Update!",
            body: "It's been over 24 hours. Tap to refresh your memory predictions with AI.",
            data: { type: "brain_update_reminder" },
          }),
        });
        if (res.ok) sent++;
        await res.text();
      } catch (e) {
        console.warn(`Push failed for ${user.id}:`, e);
      }

      // Send WhatsApp brain update reminder
      dispatchWhatsApp("brain_update", user.id, {
        summary: "It's been over 24 hours since your last brain update. Refresh your memory predictions!",
      });
    }

    console.log(`Brain update reminders sent: ${sent}`);
    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Brain update reminder error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
