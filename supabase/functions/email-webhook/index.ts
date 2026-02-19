import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);

    // GET: Tracking pixel for opens — /email-webhook?type=open&rid=<recipient_id>
    if (req.method === "GET") {
      const type = url.searchParams.get("type");
      const rid = url.searchParams.get("rid");
      const cid = url.searchParams.get("cid");

      if (type === "open" && rid) {
        const now = new Date().toISOString();
        // Update recipient opened_at
        await supabaseAdmin
          .from("campaign_recipients")
          .update({ opened_at: now, status: "opened" })
          .eq("id", rid)
          .is("opened_at", null);

        // Increment campaign opened_count
        if (cid) {
          const { data: camp } = await supabaseAdmin
            .from("campaigns")
            .select("opened_count")
            .eq("id", cid)
            .maybeSingle();
          if (camp) {
            await supabaseAdmin
              .from("campaigns")
              .update({ opened_count: (camp.opened_count || 0) + 1 })
              .eq("id", cid);
          }
        }

        // Return 1x1 transparent pixel
        const pixel = new Uint8Array([
          0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
          0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
          0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
          0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
          0x01, 0x00, 0x3b,
        ]);
        return new Response(pixel, {
          headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate" },
        });
      }

      // Click redirect — /email-webhook?type=click&rid=<recipient_id>&cid=<campaign_id>&url=<redirect_url>
      if (type === "click" && rid) {
        const now = new Date().toISOString();
        const redirectUrl = url.searchParams.get("url") || "#";

        // Update recipient clicked_at
        await supabaseAdmin
          .from("campaign_recipients")
          .update({ clicked_at: now, status: "clicked" })
          .eq("id", rid)
          .is("clicked_at", null);

        // Also mark as opened if not already
        await supabaseAdmin
          .from("campaign_recipients")
          .update({ opened_at: now })
          .eq("id", rid)
          .is("opened_at", null);

        // Increment campaign clicked_count
        if (cid) {
          const { data: camp } = await supabaseAdmin
            .from("campaigns")
            .select("clicked_count, opened_count")
            .eq("id", cid)
            .maybeSingle();
          if (camp) {
            await supabaseAdmin
              .from("campaigns")
              .update({
                clicked_count: (camp.clicked_count || 0) + 1,
                opened_count: (camp.opened_count || 0) + 1,
              })
              .eq("id", cid);
          }
        }

        // 302 redirect to actual URL
        return new Response(null, {
          status: 302,
          headers: { Location: decodeURIComponent(redirectUrl) },
        });
      }

      return new Response("Invalid tracking request", { status: 400 });
    }

    // POST: Resend webhook events
    if (req.method === "POST") {
      const payload = await req.json();
      const events = Array.isArray(payload) ? payload : [payload];

      let processed = 0;

      for (const event of events) {
        const eventType = event.type || event.event;
        const recipientId = event.data?.recipient_id || event.recipient_id;
        const campaignId = event.data?.campaign_id || event.campaign_id;
        const now = new Date().toISOString();

        if (!recipientId) continue;

        if (eventType === "email.delivered" || eventType === "delivered") {
          await supabaseAdmin
            .from("campaign_recipients")
            .update({ delivered_at: now, status: "delivered" })
            .eq("id", recipientId)
            .is("delivered_at", null);

          if (campaignId) {
            const { data: camp } = await supabaseAdmin
              .from("campaigns")
              .select("delivered_count")
              .eq("id", campaignId)
              .maybeSingle();
            if (camp) {
              await supabaseAdmin
                .from("campaigns")
                .update({ delivered_count: (camp.delivered_count || 0) + 1 })
                .eq("id", campaignId);
            }
          }
          processed++;
        }

        if (eventType === "email.opened" || eventType === "opened") {
          await supabaseAdmin
            .from("campaign_recipients")
            .update({ opened_at: now, status: "opened" })
            .eq("id", recipientId)
            .is("opened_at", null);

          if (campaignId) {
            const { data: camp } = await supabaseAdmin
              .from("campaigns")
              .select("opened_count")
              .eq("id", campaignId)
              .maybeSingle();
            if (camp) {
              await supabaseAdmin
                .from("campaigns")
                .update({ opened_count: (camp.opened_count || 0) + 1 })
                .eq("id", campaignId);
            }
          }
          processed++;
        }

        if (eventType === "email.clicked" || eventType === "clicked") {
          await supabaseAdmin
            .from("campaign_recipients")
            .update({ clicked_at: now, status: "clicked" })
            .eq("id", recipientId)
            .is("clicked_at", null);

          if (campaignId) {
            const { data: camp } = await supabaseAdmin
              .from("campaigns")
              .select("clicked_count")
              .eq("id", campaignId)
              .maybeSingle();
            if (camp) {
              await supabaseAdmin
                .from("campaigns")
                .update({ clicked_count: (camp.clicked_count || 0) + 1 })
                .eq("id", campaignId);
            }
          }
          processed++;
        }

        if (eventType === "email.bounced" || eventType === "bounced") {
          await supabaseAdmin
            .from("campaign_recipients")
            .update({ status: "failed", error_message: event.data?.reason || "bounced" })
            .eq("id", recipientId);

          if (campaignId) {
            const { data: camp } = await supabaseAdmin
              .from("campaigns")
              .select("failed_count")
              .eq("id", campaignId)
              .maybeSingle();
            if (camp) {
              await supabaseAdmin
                .from("campaigns")
                .update({ failed_count: (camp.failed_count || 0) + 1 })
                .eq("id", campaignId);
            }
          }
          processed++;
        }
      }

      return new Response(JSON.stringify({ success: true, processed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (e) {
    console.error("email-webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
