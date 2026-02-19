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

async function importPrivateKey(base64: string) {
  const raw = urlBase64ToUint8Array(base64);
  return await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
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

  // Import and sign with private key
  const privateKeyData = urlBase64ToUint8Array(vapidPrivateKey);

  // The VAPID private key is 32 bytes raw EC private key
  // We need to construct a proper PKCS8 key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Key = new Uint8Array(pkcs8Header.length + privateKeyData.length);
  pkcs8Key.set(pkcs8Header);
  pkcs8Key.set(privateKeyData, pkcs8Header.length);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Key,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

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
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
