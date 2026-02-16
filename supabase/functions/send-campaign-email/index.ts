import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const { recipientIds, subject, htmlBody, campaignId } = await req.json();
    if (!recipientIds?.length || !subject) throw new Error("Missing required fields");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user emails from auth
    let sentCount = 0;
    let failedCount = 0;

    for (const userId of recipientIds) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const email = userData?.user?.email;
        if (!email) {
          failedCount++;
          continue;
        }

        // Build tracking URLs
        const baseUrl = Deno.env.get("SUPABASE_URL");
        const trackingPixel = `<img src="${baseUrl}/functions/v1/email-webhook?action=open&rid=${userId}&cid=${campaignId}" width="1" height="1" style="display:none" />`;

        const fullHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;margin:0;padding:20px;background:#f4f4f5;color:#18181b">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="text-align:center;margin-bottom:24px">
      <h1 style="font-size:20px;color:#7c3aed;margin:0">🧠 ACRY Brain</h1>
    </div>
    <h2 style="font-size:18px;margin:0 0 16px">${subject}</h2>
    <div style="font-size:14px;line-height:1.6;color:#3f3f46">
      ${htmlBody || ""}
    </div>
    <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />
    <p style="font-size:11px;color:#a1a1aa;text-align:center">ACRY Brain — Your AI Study Companion</p>
  </div>
  ${trackingPixel}
</body>
</html>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ACRY Brain <onboarding@resend.dev>",
            to: [email],
            subject,
            html: fullHtml,
          }),
        });

        if (res.ok) {
          sentCount++;
          // Update recipient record
          if (campaignId) {
            await supabase.from("campaign_recipients")
              .update({ status: "delivered", delivered_at: new Date().toISOString(), sent_at: new Date().toISOString() })
              .eq("campaign_id", campaignId)
              .eq("user_id", userId);
          }
        } else {
          const errText = await res.text();
          console.error(`Email failed for ${userId}:`, errText);
          failedCount++;
          if (campaignId) {
            await supabase.from("campaign_recipients")
              .update({ status: "failed", error_message: errText.slice(0, 200) })
              .eq("campaign_id", campaignId)
              .eq("user_id", userId);
          }
        }
      } catch (e) {
        console.error(`Error sending to ${userId}:`, e);
        failedCount++;
      }
    }

    // Update campaign counts
    if (campaignId) {
      await supabase.from("campaigns").update({
        delivered_count: sentCount,
        failed_count: failedCount,
      }).eq("id", campaignId);
    }

    return new Response(JSON.stringify({ sentCount, failedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-campaign-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
