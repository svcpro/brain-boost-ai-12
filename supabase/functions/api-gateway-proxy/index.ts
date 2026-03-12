import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TARGET_BASE = "https://api.acry.ai/v1";
const FALLBACK_TARGET_BASE = "https://api.acry.app/v1";

// Known edge functions that should route directly to Supabase Functions
const EDGE_FUNCTION_PATHS = new Set([
  "msg91-otp",
  "api-gateway-proxy",
  "ai-brain-agent",
  "rl-agent",
  "burnout-detection",
  "memory-engine",
  "adaptive-difficulty",
  "cognitive-twin",
  "meta-learning",
  "continual-learning",
]);

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

    const requestUrl = new URL(req.url);
    const pathFromUrl = requestUrl.pathname
      .replace(/^\/+|\/+$/g, "")
      .replace(/^functions\/v1\/api-gateway-proxy\/?/i, "")
      .replace(/^api-gateway-proxy\/?/i, "");

    let parsedPayload: Record<string, unknown> | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const rawBody = await req.text();
      if (rawBody.trim().length > 0) {
        try {
          const candidate = JSON.parse(rawBody);
          parsedPayload = candidate && typeof candidate === "object"
            ? candidate as Record<string, unknown>
            : { body: candidate };
        } catch {
          return json({ ok: false, status_code: 400, error: "Invalid JSON body" });
        }
      }
    }

    const payload = parsedPayload ?? {};
    const hasEnvelope = ["method", "path", "query", "body", "base_url"].some((key) =>
      Object.prototype.hasOwnProperty.call(payload, key)
    );

    const method = String((hasEnvelope ? payload.method : req.method) || req.method || "GET").toUpperCase();
    const path = String((hasEnvelope ? payload.path : pathFromUrl) || pathFromUrl || "").replace(/^\/+|\/+$/g, "");
    const query = hasEnvelope && payload.query && typeof payload.query === "object"
      ? payload.query as Record<string, unknown>
      : Object.fromEntries(requestUrl.searchParams.entries());
    const body = method === "GET" || method === "HEAD"
      ? undefined
      : hasEnvelope
        ? (payload.body !== undefined ? payload.body : (() => {
            // If envelope keys are present but no explicit "body", extract non-envelope fields as body
            const envelopeKeys = new Set(["method", "path", "query", "body", "base_url"]);
            const extracted: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(payload)) {
              if (!envelopeKeys.has(k)) extracted[k] = v;
            }
            return Object.keys(extracted).length > 0 ? extracted : {};
          })())
        : parsedPayload;
    const requestedBase = normalizeTargetBase(hasEnvelope ? payload.base_url : undefined);
    const candidateBases = Array.from(new Set([requestedBase, DEFAULT_TARGET_BASE, FALLBACK_TARGET_BASE]));

    if (!path) {
      return json({ ok: false, status_code: 400, error: "Missing path" });
    }

    // Check if this is a known edge function — route directly to Supabase Functions
    const pathSegments = path.split("/");
    const firstSegment = pathSegments[0];
    if (EDGE_FUNCTION_PATHS.has(firstSegment)) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const functionUrl = new URL(`${supabaseUrl}/functions/v1/${path}`);
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          functionUrl.searchParams.set(key, String(value));
        }
      }

      const edgeHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
        Authorization: authHeader,
      };

      try {
        const edgeMethod = method === "GET" ? "POST" : method; // Edge functions typically use POST
        const hasBodyObject = body && typeof body === "object" && !Array.isArray(body);
        const bodyRecord = hasBodyObject ? body as Record<string, unknown> : null;
        const edgePayload = bodyRecord && Object.keys(bodyRecord).length > 0
          ? body
          : (Object.keys(query).length > 0 ? query : (body ?? {}));

        const edgeResp = await fetch(functionUrl.toString(), {
          method: edgeMethod,
          headers: edgeHeaders,
          body: JSON.stringify(edgePayload),
        });

        const raw = await edgeResp.text();
        let parsed: unknown = raw;
        try { parsed = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }

        const statusCode = edgeResp.status;
        return new Response(JSON.stringify({
          success: edgeResp.ok,
          message: edgeResp.ok ? "OK" : (typeof parsed === "object" && parsed ? (parsed as any).error || "Error" : "Error"),
          data: parsed,
        }), {
          status: statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          message: e instanceof Error ? e.message : "Edge function unreachable",
          data: null,
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

    const isTransportError = (message: string) => {
      const lower = message.toLowerCase();
      return lower.includes("handshakefailure") ||
        lower.includes("tls") ||
        lower.includes("ssl") ||
        lower.includes("dns") ||
        lower.includes("resolve") ||
        lower.includes("connect");
    };

    const isCloudflareDnsConflict = (status: number, raw: string, parsed: unknown) => {
      if (status !== 403) return false;
      const parsedText = typeof parsed === "string"
        ? parsed
        : (typeof parsed === "object" && parsed ? JSON.stringify(parsed) : "");
      const haystack = `${raw}\n${parsedText}`.toLowerCase();
      return haystack.includes("error 1000") || haystack.includes("dns points to prohibited ip");
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

        const isDnsConflict = isCloudflareDnsConflict(upstream.status, raw, parsed);

        const upstreamError =
          upstream.ok
            ? null
            : isDnsConflict
              ? `Cloudflare Error 1000: DNS points to prohibited IP (${new URL(url.toString()).hostname})`
              : (typeof parsed === "object" && parsed && ((parsed as Record<string, unknown>).message || (parsed as Record<string, unknown>).error)) ||
                `Upstream request failed (${upstream.status})`;

        finalStatus = upstream.status;
        finalOk = upstream.ok;
        finalError = upstreamError ? String(upstreamError) : null;
        finalData = parsed;
        finalTargetUrl = url.toString();
        finalTargetBase = targetBase;
        finalDetails = isDnsConflict
          ? "Cloudflare DNS for the API domain still points to a prohibited IP or proxied loop. Update DNS/proxy config and retry."
          : null;

        if (upstream.ok) break;
        if (isDnsConflict) continue;
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
