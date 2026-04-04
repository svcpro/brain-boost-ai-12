import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-route, x-api-key, api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !anonKey) {
      return json({ error: "Backend configuration missing" }, 500);
    }

    const url = new URL(req.url);
    const method = req.method.toUpperCase();

    let body: Record<string, unknown> = {};
    let rawBody = "";
    if (method !== "GET" && method !== "HEAD") {
      rawBody = await req.text();
      if (rawBody.trim()) {
        try {
          const parsed = JSON.parse(rawBody);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            body = parsed as Record<string, unknown>;
          }
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
      }
    }

    const route = String(
      req.headers.get("x-route") ||
      body.route ||
      body.action ||
      url.searchParams.get("route") ||
      url.searchParams.get("action") ||
      "init"
    ).replace(/^\/+|\/+$/g, "");

    if (!route) {
      return json({ error: "Missing action route" }, 400);
    }

    const targetUrl = new URL(`${supabaseUrl}/functions/v1/action-tab-api/${route}`);
    for (const [key, value] of url.searchParams.entries()) {
      if (key === "action" || key === "route") continue;
      targetUrl.searchParams.set(key, value);
    }

    const forwardHeaders = new Headers({
      "Content-Type": "application/json",
      apikey: anonKey,
    });

    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      forwardHeaders.set("Authorization", authHeader);
    }

    const apiKey = req.headers.get("x-api-key") || req.headers.get("api-key") || req.headers.get("apikey");
    if (apiKey) {
      forwardHeaders.set("x-api-key", apiKey);
      forwardHeaders.set("api-key", apiKey);
    }

    const xRoute = req.headers.get("x-route");
    if (xRoute) {
      forwardHeaders.set("x-route", xRoute);
    }

    const response = await fetch(targetUrl.toString(), {
      method: method === "GET" ? "POST" : method,
      headers: forwardHeaders,
      body: method === "GET" || method === "HEAD"
        ? undefined
        : (rawBody.trim() ? rawBody : JSON.stringify(body)),
    });

    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
