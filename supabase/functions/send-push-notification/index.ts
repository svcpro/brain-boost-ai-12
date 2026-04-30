import { createClient } from "npm:@supabase/supabase-js@2";
import { ApplicationServer, PushMessageError, Urgency } from "https://jsr.io/@negrel/webpush/0.5.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push crypto utilities
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  let vapidKeys: CryptoKeyPair;
  try {
    const d = vapidPrivateKey.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const pubKeyBytes = urlBase64ToUint8Array(vapidPublicKey);
    const raw = pubKeyBytes[0] === 0x04 ? pubKeyBytes : Uint8Array.from([4, ...pubKeyBytes]);
    const x = uint8ArrayToBase64Url(raw.slice(1, 33));
    const y = uint8ArrayToBase64Url(raw.slice(33, 65));
    const jwk = { kty: "EC", crv: "P-256", x, y, ext: true };
    vapidKeys = {
      publicKey: await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]),
      privateKey: await crypto.subtle.importKey("jwk", { ...jwk, d }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]),
    };
  } catch (e) {
    console.error("VAPID key import failed:", e);
    throw new Error("Invalid VAPID keys");
  }

  const appServer = await ApplicationServer.new({ contactInformation: vapidSubject, vapidKeys });
  const subscriber = appServer.subscribe({ endpoint: subscription.endpoint, keys: { auth: subscription.auth, p256dh: subscription.p256dh } });
  try {
    await subscriber.pushTextMessage(payload, { ttl: 86400, urgency: Urgency.High });
    return { success: true };
  } catch (e) {
    if (e instanceof PushMessageError && (e.response.status === 410 || e.response.status === 404)) {
      return { expired: true };
    }
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

    // Handle get-vapid-key action (no auth required)
    const reqBody = await req.clone().json().catch(() => ({}));
    if (reqBody?.action === "get-vapid-key") {
      return new Response(
        JSON.stringify({ vapidPublicKey: VAPID_PUBLIC_KEY || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth check – allow service-role key OR valid user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If the caller is using the service-role key (internal edge-function-to-edge-function call), skip user auth
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await anonClient.auth.getUser();
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { recipient_id, title, body, data: notifData } = await req.json();

    if (!recipient_id || !title) {
      return new Response(JSON.stringify({ error: "Missing recipient_id or title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check recipient's push notification preferences
    const notifType = notifData?.type as string | undefined;
    if (notifType) {
      const prefMap: Record<string, string> = {
        freeze_gift: "freezeGifts",
        streak_milestone: "streakMilestones",
        study_reminder: "studyReminders",
        brain_update_reminder: "brainUpdateReminders",
        daily_briefing: "dailyBriefing",
      };
      const prefKey = prefMap[notifType];
      if (prefKey) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("push_notification_prefs")
          .eq("id", recipient_id)
          .maybeSingle();
        const prefs = profile?.push_notification_prefs as Record<string, boolean> | null;
        if (prefs && prefs[prefKey] === false) {
          return new Response(JSON.stringify({ sent: 0, message: "Recipient opted out of this notification type" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Get recipient's push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", recipient_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body: body || "", data: notifData || {} });

    // Log notification to history
    await supabase.from("notification_history").insert({
      user_id: recipient_id,
      title,
      body: body || null,
      type: notifType || null,
    });

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subs) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
        "mailto:noreply@acry.app"
      );

      if (result.success) sent++;
      if (result.expired) expired.push(sub.id);
    }

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", expired);
    }

    return new Response(JSON.stringify({ sent, expired: expired.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Push notification error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
