import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TARGET_BASE = "https://api.acry.ai/v1";
const FALLBACK_TARGET_BASE = "https://api.acry.app/v1";

const normalizeTargetBase = (rawBase?: unknown) => {
  const candidate = typeof rawBase === "string" ? rawBase.trim().replace(/\/+$/g, "") : "";
  if (!candidate) return DEFAULT_TARGET_BASE;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== "https:") return DEFAULT_TARGET_BASE;
    if (host === "api.acry.ai" || host === "api.acry.app") return candidate;
  } catch {
    // ignore invalid base URL and use default
  }

  return DEFAULT_TARGET_BASE;
};

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
    const requestedBase = normalizeTargetBase(payload?.base_url);
    const candidateBases = Array.from(new Set([requestedBase, DEFAULT_TARGET_BASE, FALLBACK_TARGET_BASE]));

    if (!path) {
      return json({ ok: false, status_code: 400, error: "Missing path" });
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

    const isTransportError = (message: string) => {
      const lower = message.toLowerCase();
      return lower.includes("handshakefailure") ||
        lower.includes("tls") ||
        lower.includes("ssl") ||
        lower.includes("dns") ||
        lower.includes("resolve") ||
        lower.includes("connect");
    };

    let finalStatus = 503;
    let finalOk = false;
    let finalError: string | null = "Proxy upstream unreachable";
    let finalData: unknown = null;
    let finalTargetUrl: string | null = null;
    let finalTargetBase: string | null = null;
    let finalDetails: string | null = null;

    for (const targetBase of candidateBases) {
      const url = new URL(`${targetBase}/${path}`);
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }

      try {
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

        finalStatus = upstream.status;
        finalOk = upstream.ok;
        finalError = upstreamError ? String(upstreamError) : null;
        finalData = parsed;
        finalTargetUrl = url.toString();
        finalTargetBase = targetBase;

        if (upstream.ok) break;
        if (!upstreamError || !isTransportError(String(upstreamError))) break;
      } catch (fetchErr) {
        const message = fetchErr instanceof Error ? fetchErr.message : "Upstream fetch failed";
        finalStatus = 503;
        finalOk = false;
        finalError = message;
        finalDetails = "External API endpoint is unreachable from backend runtime (likely TLS/SSL or DNS issue).";
        finalTargetUrl = url.toString();
        finalTargetBase = targetBase;

        if (!isTransportError(message)) break;
      }
    }

    return json({
      ok: finalOk,
      status_code: finalStatus,
      error: finalError,
      details: finalDetails,
      data: finalData,
      target_url: finalTargetUrl,
      target_base: finalTargetBase,
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
