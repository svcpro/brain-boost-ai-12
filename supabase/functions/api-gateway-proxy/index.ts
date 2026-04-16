// Native Deno.serve used below
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, api-key, x-api-token, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TARGET_BASE = "https://api.acry.ai/v1";
const FALLBACK_TARGET_BASE = "https://api.acry.app/v1";

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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
  "onboarding",
  "home-api",
  "notification",
  "action-tab-api",
  "brain-intelligence",
  "safe-pass-prediction",
  "sureshot-prediction",
  "sureshot-questions",
  "you-tab-api",
  "alis-api",
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

const pickString = (record: Record<string, unknown> | null, keys: string[]) => {
  if (!record) return "";

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
};

const extractApiKey = (value: string) => value.match(/acry_[A-Za-z0-9]+/)?.[0] || "";

const resolveRequestIdentity = async (req: Request, requestUrl: URL, parsedPayload: Record<string, unknown> | null) => {
  const payloadBody = parsedPayload?.body && typeof parsedPayload.body === "object" && !Array.isArray(parsedPayload.body)
    ? parsedPayload.body as Record<string, unknown>
    : null;

  const headerAuthorization = String(req.headers.get("Authorization") || "").trim();
  const headerApiKeyCandidates = [
    req.headers.get("x-api-key"),
    req.headers.get("api-key"),
    req.headers.get("x-api-token"),
    req.headers.get("apikey"),
  ].map((value) => String(value || "").trim()).filter(Boolean);

  const queryAuthorization = String(requestUrl.searchParams.get("Authorization") || requestUrl.searchParams.get("authorization") || "").trim();
  const queryApiKeyCandidates = [
    requestUrl.searchParams.get("x-api-key"),
    requestUrl.searchParams.get("api-key"),
    requestUrl.searchParams.get("x-api-token"),
    requestUrl.searchParams.get("apikey"),
    requestUrl.searchParams.get("apiKey"),
  ].map((value) => String(value || "").trim()).filter(Boolean);

  const bodyAuthorization = [parsedPayload, payloadBody]
    .map((record) => pickString(record, ["Authorization", "authorization"]))
    .find(Boolean) || "";
  const bodyApiKeyCandidates = [parsedPayload, payloadBody]
    .map((record) => pickString(record, ["x-api-key", "api-key", "x-api-token", "apikey", "apiKey"]))
    .filter(Boolean);

  const authSources = [headerAuthorization, queryAuthorization, bodyAuthorization].filter(Boolean);
  const apiKeySources = [...headerApiKeyCandidates, ...queryApiKeyCandidates, ...bodyApiKeyCandidates].filter(Boolean);

  let userId: string | null = null;
  let forwardedAuthorization = "";
  let forwardedApiKey = apiKeySources.map(extractApiKey).find(Boolean) || "";

  const bearerToken = headerAuthorization.startsWith("Bearer ")
    ? headerAuthorization.replace("Bearer ", "").trim()
    : "";

  // Try 0: OTP auth session lookup (token_hash from msg91-otp verify)
  // Must come before API key fallback to avoid resolving the shared key owner
  {
    const allTokenCandidates = [bearerToken, headerAuthorization.trim()].filter(Boolean);
    for (const candidate of allTokenCandidates) {
      const raw = candidate.startsWith("Bearer ") ? candidate.replace("Bearer ", "").trim() : candidate;
      if (!raw || raw.split(".").length === 3) continue;
      const { data: otpSession } = await adminClient
        .from("otp_auth_sessions")
        .select("user_id")
        .eq("token_hash", raw)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();
      if (otpSession?.user_id) {
        userId = otpSession.user_id;
        console.log(`[api-gateway-proxy] Resolved user ${userId} via OTP session`);
        break;
      }
    }
  }

  if (!userId && bearerToken) {
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: userData, error: userError } = await adminClient.auth.getUser(bearerToken);
      if (!userError && userData?.user?.id) {
        userId = userData.user.id;
        forwardedAuthorization = headerAuthorization;
        break;
      }

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }

  if (!userId) {
    const apiKeyCandidates = [...apiKeySources, ...authSources]
      .map((value) => value.startsWith("Bearer ") ? value.replace("Bearer ", "").trim() : value.trim())
      .filter(Boolean);

    for (const candidate of apiKeyCandidates) {
      const extractedApiKey = extractApiKey(candidate);
      if (!extractedApiKey) continue;

      const storedPrefix = `${extractedApiKey.substring(0, 10)}...`;
      const { data: keyRow } = await adminClient
        .from("api_keys")
        .select("created_by")
        .eq("key_prefix", storedPrefix)
        .eq("is_active", true)
        .maybeSingle();

      if (keyRow?.created_by) {
        userId = keyRow.created_by;
        forwardedApiKey = extractedApiKey;
        break;
      }
    }

    if (!userId) {
      for (const candidate of apiKeyCandidates) {
        const normalizedCandidate = candidate.startsWith("Bearer ")
          ? candidate.replace("Bearer ", "").trim()
          : candidate.trim();
        if (!normalizedCandidate) continue;

        const { data: keyRow } = await adminClient
          .from("api_keys")
          .select("created_by")
          .eq("key_hash", normalizedCandidate)
          .eq("is_active", true)
          .maybeSingle();

        if (keyRow?.created_by) {
          userId = keyRow.created_by;
          forwardedApiKey = forwardedApiKey || extractApiKey(normalizedCandidate);
          break;
        }
      }
    }
  }

  return {
    userId,
    forwardedAuthorization,
    forwardedApiKey,
    debug: {
      hasAuthHeader: !!headerAuthorization,
      hasApiKeyHeader: headerApiKeyCandidates.length > 0,
      hasQueryAuthorization: !!queryAuthorization,
      hasQueryApiKey: queryApiKeyCandidates.length > 0,
      hasBodyAuthorization: !!bodyAuthorization,
      hasBodyApiKey: bodyApiKeyCandidates.length > 0,
    },
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { userId, forwardedAuthorization, forwardedApiKey, debug } = await resolveRequestIdentity(req, requestUrl, parsedPayload);
    if (!userId) {
      console.log("[api-gateway-proxy] auth resolution failed", debug);
      return json({ ok: false, status_code: 401, error: "Unauthorized" });
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
      };

      if (forwardedAuthorization) {
        edgeHeaders.Authorization = forwardedAuthorization;
      }
      if (forwardedApiKey) {
        edgeHeaders["x-api-key"] = forwardedApiKey;
        edgeHeaders["api-key"] = forwardedApiKey;
      }

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
        const contentType = edgeResp.headers.get("content-type") || "application/json";

        return new Response(raw, {
          status: edgeResp.status,
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
          },
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
    };
    if (forwardedAuthorization) {
      forwardHeaders.Authorization = forwardedAuthorization;
    }
    if (forwardedApiKey) {
      forwardHeaders["x-api-key"] = forwardedApiKey;
      forwardHeaders["api-key"] = forwardedApiKey;
    }

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
