// Facebook (Meta) Conversion API - server-side event tracker
// Hashes PII, posts to Graph API, logs every attempt to meta_capi_events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v21.0";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashIfPresent(v: unknown): Promise<string | undefined> {
  if (!v || typeof v !== "string") return undefined;
  return await sha256Hex(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const {
      event_name,
      event_id,
      event_source_url,
      action_source = "website",
      user_data = {},
      custom_data = {},
      user_id = null,
    } = body || {};

    if (!event_name || typeof event_name !== "string") {
      return new Response(JSON.stringify({ error: "event_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load config
    const { data: cfg } = await supabase
      .from("meta_capi_config").select("*").limit(1).maybeSingle();

    if (!cfg || !cfg.enabled || !cfg.pixel_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled_or_not_configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "META_CAPI_ACCESS_TOKEN not set" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build hashed user_data per Meta spec
    const ud: Record<string, unknown> = {};
    const em = await hashIfPresent(user_data.email); if (em) ud.em = [em];
    const ph = await hashIfPresent(String(user_data.phone || "").replace(/\D/g, "")); if (ph) ud.ph = [ph];
    const fn = await hashIfPresent(user_data.first_name); if (fn) ud.fn = [fn];
    const ln = await hashIfPresent(user_data.last_name); if (ln) ud.ln = [ln];
    const ct = await hashIfPresent(user_data.city); if (ct) ud.ct = [ct];
    const country = await hashIfPresent(user_data.country); if (country) ud.country = [country];
    const external_id = await hashIfPresent(user_data.external_id || user_id || crypto.randomUUID());
    if (external_id) ud.external_id = [external_id];

    // Auto-fill IP + UA from request headers if missing — required by Meta for matching
    const xff = req.headers.get("x-forwarded-for") || "";
    const ip = user_data.client_ip_address || xff.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
    const ua = user_data.client_user_agent || req.headers.get("user-agent") || "";
    if (ip) ud.client_ip_address = ip;
    if (ua) ud.client_user_agent = ua;
    if (user_data.fbc) ud.fbc = user_data.fbc;
    if (user_data.fbp) ud.fbp = user_data.fbp;

    const payload: Record<string, unknown> = {
      data: [{
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event_id || crypto.randomUUID(),
        event_source_url,
        action_source,
        user_data: ud,
        custom_data: {
          currency: custom_data.currency || cfg.default_currency || "INR",
          ...custom_data,
        },
      }],
    };
    if (cfg.test_event_code) payload.test_event_code = cfg.test_event_code;

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.pixel_id}/events?access_token=${encodeURIComponent(accessToken)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const respJson = await resp.json().catch(() => ({}));

    // Fire-and-forget log
    supabase.from("meta_capi_events").insert({
      event_name,
      event_id: (payload.data as any)[0].event_id,
      user_id,
      event_source_url,
      status: resp.ok ? "sent" : "error",
      http_status: resp.status,
      fb_trace_id: respJson?.fbtrace_id || null,
      request_payload: payload,
      response_payload: respJson,
      error: resp.ok ? null : (respJson?.error?.message || `HTTP ${resp.status}`),
    }).then(() => {});

    return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, response: respJson }), {
      status: resp.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
