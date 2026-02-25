import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_BASE = "https://api.acry.ai/v1";

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, status_code: 401, error: "Unauthorized" });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await authClient.auth.getUser();
    if (userErr || !user) {
      return json({ ok: false, status_code: 401, error: "Unauthorized" });
    }

    const payload = await req.json();
    const method = String(payload?.method || "GET").toUpperCase();
    const path = String(payload?.path || "").replace(/^\/+|\/+$/g, "");
    const query = payload?.query && typeof payload.query === "object" ? payload.query : {};
    const body = payload?.body;

    if (!path) {
      return json({ ok: false, status_code: 400, error: "Missing path" });
    }

    const url = new URL(`${TARGET_BASE}/${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const forwardHeaders: Record<string, string> = {
      Accept: "application/json",
      apikey: Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "",
      Authorization: authHeader,
    };

    const shouldSendBody = method !== "GET" && method !== "HEAD";
    if (shouldSendBody) {
      forwardHeaders["Content-Type"] = "application/json";
    }

    const upstream = await fetch(url.toString(), {
      method,
      headers: forwardHeaders,
      ...(shouldSendBody ? { body: JSON.stringify(body ?? {}) } : {}),
    });

    const raw = await upstream.text();
    let parsed: unknown = raw;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      // keep raw text
    }

    const upstreamError =
      upstream.ok
        ? null
        : (typeof parsed === "object" && parsed && ((parsed as Record<string, unknown>).message || (parsed as Record<string, unknown>).error)) ||
          `Upstream request failed (${upstream.status})`;

    return json({
      ok: upstream.ok,
      status_code: upstream.status,
      error: upstreamError,
      data: parsed,
      target_url: url.toString(),
    });
  } catch (e) {
    return json({
      ok: false,
      status_code: 503,
      error: e instanceof Error ? e.message : "Proxy error",
      details: "External API endpoint is unreachable from backend runtime (likely TLS/SSL issue).",
    });
  }
});
