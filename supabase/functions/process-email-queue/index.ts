import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pending emails (batch of 50)
    const now = new Date().toISOString();
    const { data: pendingEmails, error } = await adminClient
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!pendingEmails?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const email of pendingEmails) {
      try {
        // Mark as processing
        await adminClient.from("email_queue")
          .update({ status: "processing" })
          .eq("id", email.id);

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ACRY <notifications@acry.ai>",
            to: [email.to_email],
            subject: email.subject,
            html: email.html_body,
          }),
        });

        if (res.ok) {
          await adminClient.from("email_queue").update({
            status: "sent", sent_at: new Date().toISOString(),
          }).eq("id", email.id);

          await adminClient.from("email_logs").insert({
            user_id: email.user_id, trigger_key: email.trigger_key,
            template_id: email.template_id, to_email: email.to_email,
            subject: email.subject, status: "sent", metadata: email.variables,
          });

          // Track Resend usage
          adminClient.rpc("increment_api_usage", { p_service_name: "resend" }).then(() => {}).catch(() => {});
          sent++;
        } else {
          const errText = await res.text();
          const retryCount = email.retry_count + 1;
          const newStatus = retryCount >= email.max_retries ? "failed" : "pending";

          await adminClient.from("email_queue").update({
            status: newStatus, error_message: errText, retry_count: retryCount,
          }).eq("id", email.id);

          if (newStatus === "failed") {
            await adminClient.from("email_logs").insert({
              user_id: email.user_id, trigger_key: email.trigger_key,
              template_id: email.template_id, to_email: email.to_email,
              subject: email.subject, status: "failed", error_message: errText,
              metadata: email.variables,
            });
          }
          failed++;
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Unknown error";
        await adminClient.from("email_queue").update({
          status: "failed", error_message: errMsg,
          retry_count: email.retry_count + 1,
        }).eq("id", email.id);
        failed++;
      }
    }

    console.log(`Email queue processed: ${sent} sent, ${failed} failed`);
    return new Response(JSON.stringify({ processed: pendingEmails.length, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-email-queue error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
