import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Twilio sends form-encoded data
    const formData = await req.text();
    const params = new URLSearchParams(formData);

    const messageSid = params.get("MessageSid") || params.get("SmsSid");
    const messageStatus = params.get("MessageStatus") || params.get("SmsStatus");
    const errorCode = params.get("ErrorCode");
    const errorMessage = params.get("ErrorMessage");

    if (!messageSid) {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const statusMap: Record<string, string> = {
      queued: "queued",
      sent: "sent",
      delivered: "delivered",
      read: "read",
      failed: "failed",
      undelivered: "undelivered",
    };

    const normalizedStatus = statusMap[messageStatus?.toLowerCase() || ""] || messageStatus || "unknown";

    const updateData: Record<string, any> = {
      status: normalizedStatus,
    };

    if (normalizedStatus === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    } else if (normalizedStatus === "read") {
      updateData.delivered_at = updateData.delivered_at || new Date().toISOString();
      updateData.read_at = new Date().toISOString();
    } else if (normalizedStatus === "failed" || normalizedStatus === "undelivered") {
      updateData.error_code = errorCode;
      updateData.error_message = errorMessage;
    }

    await supabase
      .from("whatsapp_messages")
      .update(updateData)
      .eq("twilio_sid", messageSid);

    console.log(`WhatsApp webhook: ${messageSid} → ${normalizedStatus}`);

    // Twilio expects 200 response
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
