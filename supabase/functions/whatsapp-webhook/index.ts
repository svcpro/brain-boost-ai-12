import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Twilio SID format: SM followed by 32 hex characters
const SID_REGEX = /^(SM|MM)[a-f0-9]{32}$/i;

const VALID_STATUSES = new Set([
  "queued", "sent", "delivered", "read", "failed", "undelivered",
]);

/**
 * Verify Twilio request signature using X-Twilio-Signature header.
 */
async function verifyTwilioSignature(
  url: string,
  params: URLSearchParams,
  signature: string,
  authToken: string,
): Promise<boolean> {
  // Build the data string: URL + sorted params concatenated as key=value
  const sortedKeys = Array.from(params.keys()).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params.get(key);
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === signature;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify Twilio signature
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioSignature = req.headers.get("x-twilio-signature") || "";

    const formData = await req.text();
    const params = new URLSearchParams(formData);

    if (twilioAuthToken && twilioSignature) {
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`;
      const isValid = await verifyTwilioSignature(webhookUrl, params, twilioSignature, twilioAuthToken);
      if (!isValid) {
        console.error("Invalid Twilio signature");
        return new Response("<Response/>", {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "text/xml" },
        });
      }
    }

    const messageSid = params.get("MessageSid") || params.get("SmsSid");
    const messageStatus = params.get("MessageStatus") || params.get("SmsStatus");
    const errorCode = params.get("ErrorCode");
    const errorMessage = params.get("ErrorMessage");

    // Validate MessageSid format
    if (!messageSid || !SID_REGEX.test(messageSid)) {
      return new Response("<Response/>", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }

    // Strictly validate status - reject unknown values
    const normalizedStatus = messageStatus?.toLowerCase() || "";
    if (!VALID_STATUSES.has(normalizedStatus)) {
      console.warn(`Unknown WhatsApp status: ${normalizedStatus}`);
      return new Response("<Response/>", { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } });
    }

    const updateData: Record<string, any> = {
      status: normalizedStatus,
    };

    if (normalizedStatus === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    } else if (normalizedStatus === "read") {
      updateData.delivered_at = updateData.delivered_at || new Date().toISOString();
      updateData.read_at = new Date().toISOString();
    } else if (normalizedStatus === "failed" || normalizedStatus === "undelivered") {
      // Sanitize and truncate error fields
      updateData.error_code = errorCode ? String(errorCode).slice(0, 10) : null;
      updateData.error_message = errorMessage ? String(errorMessage).slice(0, 500) : null;
    }

    await supabase
      .from("whatsapp_messages")
      .update(updateData)
      .eq("twilio_sid", messageSid);

    console.log(`WhatsApp webhook: ${messageSid} → ${normalizedStatus}`);

    return new Response("<Response/>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (e) {
    console.error("whatsapp-webhook error:", e);
    return new Response("<Response/>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  }
});
