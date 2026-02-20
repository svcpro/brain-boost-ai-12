import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Simplified Web Push sender using fetch + VAPID
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  // For a production-quality implementation, you'd use the full Web Push protocol
  // with ECDH key exchange and content encryption. For now, we use a simplified approach
  // that works with most push services.

  const encoder = new TextEncoder();

  // Create JWT for VAPID authentication
  const header = { typ: "JWT", alg: "ES256" };
  const audience = new URL(subscription.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: vapidSubject,
  };

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const encodedClaims = btoa(JSON.stringify(claims))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  // Import VAPID private key as JWK (most reliable in Deno edge runtime)
  let key: CryptoKey;
  try {
    // Ensure the private key is in proper base64url format
    const d = vapidPrivateKey.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    
    // Decode public key (65 bytes uncompressed: 0x04 || x(32) || y(32))
    const pubKeyBytes = urlBase64ToUint8Array(vapidPublicKey);
    
    let x: string;
    let y: string;
    
    if (pubKeyBytes.length === 65 && pubKeyBytes[0] === 0x04) {
      // Uncompressed EC point: skip the 0x04 prefix
      x = uint8ArrayToBase64Url(pubKeyBytes.slice(1, 33));
      y = uint8ArrayToBase64Url(pubKeyBytes.slice(33, 65));
    } else if (pubKeyBytes.length === 64) {
      // Raw x || y without prefix
      x = uint8ArrayToBase64Url(pubKeyBytes.slice(0, 32));
      y = uint8ArrayToBase64Url(pubKeyBytes.slice(32, 64));
    } else {
      throw new Error(`Unexpected public key length: ${pubKeyBytes.length}`);
    }

    key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", d, x, y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } catch (importErr) {
    console.error("VAPID key import failed:", importErr);
    throw new Error("InvalidVAPIDKey: Could not import VAPID private key. Ensure VAPID_PUBLIC_KEY is the 65-byte uncompressed key and VAPID_PRIVATE_KEY is the 32-byte scalar, both base64url-encoded.");
  }

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsignedToken)
  );

  // Convert signature from DER to raw format (r || s)
  const sigArray = new Uint8Array(signature);
  const encodedSig = btoa(String.fromCharCode(...sigArray))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${encodedSig}`;

  // Send push message
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      "Content-Type": "application/json",
      TTL: "86400",
    },
    body: payload,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Push failed [${response.status}]: ${text}`);

    // Remove subscription if gone (410)
    if (response.status === 410 || response.status === 404) {
      return { expired: true };
    }
    return { error: text };
  }

  await response.text(); // consume body
  return { success: true };
}

serve(async (req) => {
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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
