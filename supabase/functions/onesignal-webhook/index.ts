// OneSignal webhook receiver — updates delivery rows on click/displayed events.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({} as any));
    const event = body.event || body.type;
    const notifId = body.id || body.notification_id;
    if (notifId) {
      const update: Record<string, unknown> = {};
      if (event === "notification.clicked" || body.event === "click") {
        update.status = "clicked";
        update.clicked_at = new Date().toISOString();
      } else if (event === "notification.displayed" || event === "delivered") {
        update.status = "delivered";
      }
      if (Object.keys(update).length) {
        await supabase.from("push_deliveries").update(update).eq("onesignal_notification_id", notifId);
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
