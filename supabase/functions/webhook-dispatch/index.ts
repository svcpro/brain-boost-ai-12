import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, securityHeaders } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, ...securityHeaders } });
  }

  try {
    const { event_type, payload, institution_id, user_id } = await req.json();
    if (!event_type || !payload) {
      return new Response(JSON.stringify({ error: "event_type and payload required" }), {
        status: 400,
        headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find matching webhooks
    let query = admin.from("webhook_endpoints")
      .select("*")
      .eq("is_active", true)
      .contains("events", [event_type]);

    if (institution_id) {
      query = query.eq("institution_id", institution_id);
    }

    const { data: webhooks } = await query;
    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0 }), {
        headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
      });
    }

    let dispatched = 0;

    for (const wh of webhooks) {
      const body = JSON.stringify({
        event: event_type,
        timestamp: new Date().toISOString(),
        data: payload,
        user_id,
      });

      // HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(wh.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      const signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

      const start = Date.now();
      try {
        const res = await fetch(wh.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ACRY-Signature": signature,
            "X-ACRY-Event": event_type,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        const latency = Date.now() - start;
        const responseBody = await res.text().catch(() => "");

        await admin.from("webhook_deliveries").insert({
          webhook_id: wh.id,
          event_type,
          payload,
          status_code: res.status,
          response_body: responseBody.slice(0, 1000),
          latency_ms: latency,
        });

        await admin.from("webhook_endpoints").update({
          last_triggered_at: new Date().toISOString(),
          last_status_code: res.status,
          failure_count: res.ok ? 0 : (wh.failure_count || 0) + 1,
        }).eq("id", wh.id);

        if (res.ok) dispatched++;
      } catch (err) {
        const latency = Date.now() - start;
        await admin.from("webhook_deliveries").insert({
          webhook_id: wh.id,
          event_type,
          payload,
          status_code: 0,
          response_body: String(err).slice(0, 500),
          latency_ms: latency,
        });

        await admin.from("webhook_endpoints").update({
          last_triggered_at: new Date().toISOString(),
          last_status_code: 0,
          failure_count: (wh.failure_count || 0) + 1,
        }).eq("id", wh.id);
      }
    }

    // Auto-disable after 10 consecutive failures
    await admin.from("webhook_endpoints")
      .update({ is_active: false })
      .gte("failure_count", 10);

    return new Response(JSON.stringify({ dispatched, total: webhooks.length }), {
      headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
    });
  }
});
