import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, requireAdmin, handleCors, jsonResponse, errorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendWhatsAppRequest {
  to: string;
  message?: string;
  template_name?: string;
  template_params?: Record<string, string>;
  media_url?: string;
  user_id?: string;
  category?: string;
}

// Phone number validation: E.164 format
const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

async function sendTwilioWhatsApp(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string,
  mediaUrl?: string,
): Promise<{ sid: string; status: string; error_code?: string; error_message?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const formData = new URLSearchParams();
  formData.append("From", `whatsapp:${from}`);
  formData.append("To", `whatsapp:${to}`);
  formData.append("Body", body);
  if (mediaUrl) {
    formData.append("MediaUrl", mediaUrl);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const callbackUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  formData.append("StatusCallback", callbackUrl);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const data = await resp.json();

  if (!resp.ok) {
    return {
      sid: "",
      status: "failed",
      error_code: String(data.code || resp.status),
      error_message: data.message || "Twilio API error",
    };
  }

  return {
    sid: data.sid,
    status: data.status || "queued",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the request - require admin access
    let auth;
    try {
      auth = await authenticateRequest(req);
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    // Require admin role for sending WhatsApp messages
    try {
      await requireAdmin(auth.userId);
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
      throw new Error("Twilio credentials not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: SendWhatsAppRequest | SendWhatsAppRequest[] = await req.json();
    const requests = Array.isArray(body) ? body : [body];

    // Limit batch size
    if (requests.length > 100) {
      return errorResponse("Batch size exceeds maximum of 100", 400);
    }

    const results: { to: string; status: string; sid?: string; error?: string }[] = [];

    for (const item of requests) {
      try {
        // Validate phone number
        if (!item.to || !PHONE_REGEX.test(item.to)) {
          results.push({ to: item.to || "unknown", status: "failed", error: "Invalid phone number format" });
          continue;
        }

        let messageBody = item.message || "";

        // Resolve template if provided
        if (item.template_name && !messageBody) {
          const { data: tmpl } = await supabase
            .from("whatsapp_templates")
            .select("body_template, variables")
            .eq("name", item.template_name)
            .eq("is_active", true)
            .maybeSingle();

          if (tmpl) {
            messageBody = tmpl.body_template;
            const vars = tmpl.variables as string[] || [];
            const params = item.template_params || {};
            vars.forEach((v: string, i: number) => {
              messageBody = messageBody.replace(`{{${i + 1}}}`, params[v] || `{{${v}}}`);
            });
          } else {
            messageBody = `Template "${item.template_name}" not found.`;
          }
        }

        if (!messageBody) {
          results.push({ to: item.to, status: "failed", error: "No message content" });
          continue;
        }

        // Truncate message to WhatsApp limit
        if (messageBody.length > 4096) {
          messageBody = messageBody.slice(0, 4096);
        }

        // Send via Twilio
        const result = await sendTwilioWhatsApp(
          TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN,
          TWILIO_WHATSAPP_NUMBER,
          item.to,
          messageBody,
          item.media_url,
        );

        // Log to database
        await supabase.from("whatsapp_messages").insert({
          user_id: item.user_id || null,
          to_number: item.to,
          message_type: item.media_url ? "media" : item.template_name ? "template" : "text",
          content: messageBody,
          template_name: item.template_name || null,
          template_params: item.template_params || null,
          media_url: item.media_url || null,
          twilio_sid: result.sid || null,
          status: result.status,
          error_code: result.error_code || null,
          error_message: result.error_message || null,
          category: item.category || "manual",
        });

        results.push({
          to: item.to,
          status: result.status,
          sid: result.sid,
          error: result.error_message,
        });

        // Rate limiting between messages
        if (requests.length > 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (err) {
        console.error(`WhatsApp send error for ${item.to}:`, err);
        results.push({ to: item.to, status: "failed", error: "Send failed" });
      }
    }

    const sent = results.filter(r => r.status !== "failed").length;
    const failed = results.filter(r => r.status === "failed").length;

    return jsonResponse({ sent, failed, results });
  } catch (e) {
    console.error("send-whatsapp error:", e);
    return errorResponse("Internal error", 500);
  }
});
