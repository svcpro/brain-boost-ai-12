// Register/update a OneSignal player ID for the authenticated user.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const { player_id, device_type, device_os, browser, language, timezone, is_subscribed = true } = body;
    if (!player_id) return new Response(JSON.stringify({ error: "player_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { error } = await admin.from("onesignal_players").upsert({
      user_id: user.id,
      player_id,
      external_id: user.id,
      device_type, device_os, browser, language, timezone,
      is_subscribed,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id,player_id" });
    if (error) throw error;

    // Tag external user id in OneSignal so include_external_user_ids works
    const APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (APP_ID && KEY) {
      try {
        await fetch(`https://onesignal.com/api/v1/players/${player_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Basic ${KEY}` },
          body: JSON.stringify({ app_id: APP_ID, external_user_id: user.id }),
        });
      } catch { /* non-blocking */ }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "err" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
