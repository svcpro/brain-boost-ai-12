import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
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
        const rawRedirectUrl = url.searchParams.get("url") || "";

        // Validate redirect URL to prevent open redirect attacks
        let safeRedirectUrl = "https://acry.ai";
        if (rawRedirectUrl) {
          try {
            const decoded = decodeURIComponent(rawRedirectUrl);
            const target = new URL(decoded);
            const allowedDomains = ["acry.app", "acry.ai", "www.acry.app", "www.acry.ai"];
            if (allowedDomains.some(d => target.hostname === d || target.hostname.endsWith("." + d))) {
              safeRedirectUrl = decoded;
            } else {
              console.warn("Blocked open redirect attempt to:", target.hostname);
              return new Response("Invalid redirect target", { status: 400 });
            }
          } catch {
            console.warn("Invalid redirect URL:", rawRedirectUrl);
            return new Response("Invalid redirect URL", { status: 400 });
          }
        }

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

        // 302 redirect to validated URL
        return new Response(null, {
          status: 302,
          headers: { Location: safeRedirectUrl },
        });
      }

      return new Response("Invalid tracking request", { status: 400 });
    }

    // POST: Resend webhook events — verify HMAC signature
    if (req.method === "POST") {
      const rawBody = await req.text();
      const secret = Deno.env.get("EMAIL_WEBHOOK_SECRET");
      if (!secret) {
        console.error("EMAIL_WEBHOOK_SECRET not configured — rejecting webhook");
        return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const provided = req.headers.get("x-acry-signature") ||
                       req.headers.get("svix-signature") ||
                       req.headers.get("x-webhook-signature") || "";

      // Compute HMAC-SHA256(rawBody) using shared secret
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
      const expected = Array.from(new Uint8Array(sigBuf))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      // Constant-time compare (allow either raw hex or "sha256=hex" or svix-style "v1,<base64>")
      const candidates = provided.split(/[, ]/).map(s => s.replace(/^sha256=/, "").replace(/^v1,?/, "").trim());
      const ok = candidates.some(c => c.length === expected.length && timingSafeEqualHex(c, expected));
      if (!ok) {
        console.warn("email-webhook: invalid signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.parse(rawBody);
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
