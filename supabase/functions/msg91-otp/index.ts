import { createClient } from "npm:@supabase/supabase-js@2";
import { issueUserApiKey } from "../_shared/api-key-auth.ts";
import { buildPhoneVariants, purgeUserGraph } from "../_shared/user-purge.ts";

/* ═══════════════════════════════════════════════════════════
   MSG91 OTP Edge Function — aligned with official docs:
   https://docs.msg91.com/otp/sendotp
   https://docs.msg91.com/otp/verify-otp
   https://docs.msg91.com/otp/resend-otp
   ═══════════════════════════════════════════════════════════ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Utilities ───────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Normalize Indian mobile numbers to 91XXXXXXXXXX format */
function normalizeIndianMobile(rawMobile: unknown): string | null {
  if (rawMobile === null || rawMobile === undefined) return null;
  const raw = typeof rawMobile === "string" || typeof rawMobile === "number" ? String(rawMobile) : "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const cleaned = digits.startsWith("00") ? digits.slice(2) : digits;

  if (/^\d{10}$/.test(cleaned)) return `91${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `91${cleaned.slice(1)}`;
  if (/^91\d{10}$/.test(cleaned)) return cleaned;

  return null;
}

async function cleanupStalePhoneSignupData(adminClient: ReturnType<typeof getAdminClient>, normalizedMobile: string) {
  const placeholderEmail = `${normalizedMobile}@phone.acry.ai`;
  const staleUserIds = new Set<string>();

  for (const phoneVariant of buildPhoneVariants(normalizedMobile)) {
    const { data: profileRows, error } = await adminClient
      .from("profiles")
      .select("id")
      .eq("phone", phoneVariant);

    if (error) {
      throw new Error(`Failed to look up stale phone profile (${phoneVariant}): ${error.message}`);
    }

    profileRows?.forEach((row) => staleUserIds.add(row.id));
  }

  const { data: emailRows, error: emailLookupError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", placeholderEmail);

  if (emailLookupError) {
    throw new Error(`Failed to look up stale phone email profile: ${emailLookupError.message}`);
  }

  emailRows?.forEach((row) => staleUserIds.add(row.id));

  await purgeUserGraph(adminClient, [...staleUserIds]);
}

// ─── Parameter Extraction ────────────────────────────────

function toStr(v: unknown): string | undefined {
  if (typeof v === "string") { const t = v.trim(); return t.length > 0 ? t : undefined; }
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return undefined;
}

function readParam(src: unknown, key: string): string | undefined {
  if (!src || typeof src !== "object" || Array.isArray(src)) return undefined;
  return toStr((src as Record<string, unknown>)[key]);
}

function extractParams(req: Request, url: URL, decodedPath: string, bodyPayload: Record<string, unknown>) {
  const embeddedQS = decodedPath.includes("?") ? decodedPath.split("?").slice(1).join("?") : "";
  const embeddedParams = new URLSearchParams(embeddedQS);

  const bodyNested = bodyPayload.body && typeof bodyPayload.body === "object" && !Array.isArray(bodyPayload.body)
    ? bodyPayload.body as Record<string, unknown> : undefined;

  const bodyQueryParams = bodyPayload.query ? new URLSearchParams(
    Object.entries(bodyPayload.query as Record<string, unknown>)
      .filter(([, v]) => Boolean(toStr(v)))
      .map(([k, v]) => [k, toStr(v) as string])
  ) : new URLSearchParams();

  const bodyPathStr = typeof bodyPayload.path === "string" && bodyPayload.path.includes("?")
    ? new URLSearchParams(bodyPayload.path.split("?").slice(1).join("?")) : new URLSearchParams();

  const pick = (key: string) =>
    toStr(url.searchParams.get(key)) ||
    toStr(embeddedParams.get(key)) ||
    toStr(bodyQueryParams.get(key)) ||
    toStr(bodyPathStr.get(key)) ||
    readParam(bodyPayload, key) ||
    readParam(bodyNested, key);

  let action = pick("action");
  let mobile = pick("mobile");
  const otp = pick("otp");

  // Fallback: check proxy headers for mobile
  if (!mobile) {
    for (const hdr of ["x-original-url", "x-forwarded-uri", "x-rewrite-url", "x-original-uri"]) {
      const val = req.headers.get(hdr);
      if (!val) continue;
      const qs = val.includes("?") ? val.split("?").slice(1).join("?") : "";
      const hp = new URLSearchParams(qs);
      if (!action) action = toStr(hp.get("action"));
      const m = toStr(hp.get("mobile"));
      if (m) { mobile = m; break; }
    }
  }

  // Fallback: action from path segment
  if (!action) {
    const lastSeg = decodedPath.split("/").filter(Boolean).pop() || "";
    const map: Record<string, string> = {
      send: "send", "send-whatsapp": "send_whatsapp",
      verify: "verify", resend: "resend", "resend-whatsapp": "resend_whatsapp",
    };
    action = map[lastSeg] || action;
  }

  return { action, mobile, otp };
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === "GET" || req.method === "HEAD") return {};
  const raw = await req.text();
  if (!raw.trim()) return {};

  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const trimmed = raw.trim();

  // Try JSON first
  if (ct.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }

  // Try form-encoded
  const fp = new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
  if (Array.from(fp.keys()).length > 0) return Object.fromEntries(fp.entries());

  return {};
}

// ─── MSG91 API Calls (per official docs) ─────────────────

/**
 * POST https://control.msg91.com/api/v5/otp
 * Query: template_id, mobile
 * Headers: authkey, Content-Type: application/json
 * Optional query: otp_expiry, otp_length, realTimeResponse
 */
async function msg91SendOTP(authKey: string, templateId: string, mobile: string) {
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp_expiry", "5");
  url.searchParams.set("otp_length", "4");
  url.searchParams.set("realTimeResponse", "1");

  const resp = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
  });
  const rawText = await resp.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[MSG91] SendOTP returned non-JSON:", rawText.slice(0, 500));
    data = { type: "error", message: rawText.slice(0, 200) };
  }
  console.log("[MSG91] SendOTP response:", JSON.stringify(data));
  return { data, ok: resp.ok };
}

/**
 * GET https://control.msg91.com/api/v5/otp/verify
 * Query: otp, mobile
 * Headers: authkey
 */
async function msg91VerifyOTP(authKey: string, mobile: string, otp: string) {
  const url = new URL("https://control.msg91.com/api/v5/otp/verify");
  url.searchParams.set("otp", otp);
  url.searchParams.set("mobile", mobile);

  const resp = await fetch(url.toString(), {
    method: "GET",
    headers: { authkey: authKey },
  });
  const rawText = await resp.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[MSG91] VerifyOTP returned non-JSON:", rawText.slice(0, 500));
    data = { type: "error", message: rawText.slice(0, 200) };
  }
  console.log("[MSG91] VerifyOTP response:", JSON.stringify(data));
  return { data, ok: resp.ok };
}

/**
 * GET https://control.msg91.com/api/v5/otp/retry
 * Query: authkey, retrytype, mobile
 */
async function msg91ResendOTP(authKey: string, mobile: string, retryType: string = "text") {
  const url = new URL("https://control.msg91.com/api/v5/otp/retry");
  url.searchParams.set("authkey", authKey);
  url.searchParams.set("retrytype", retryType);
  url.searchParams.set("mobile", mobile);

  const resp = await fetch(url.toString(), { method: "GET" });
  const rawText = await resp.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[MSG91] ResendOTP returned non-JSON:", rawText.slice(0, 500));
    data = { type: "error", message: rawText.slice(0, 200) };
  }
  console.log("[MSG91] ResendOTP response:", JSON.stringify(data));
  return { data, ok: resp.ok };
}

// ─── WhatsApp OTP Helpers ────────────────────────────────

function generateOTP4(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function storeWhatsAppOTP(adminClient: ReturnType<typeof getAdminClient>, mobile: string, otp: string) {
  await adminClient.from("whatsapp_otps").delete().eq("mobile", mobile).eq("verified", false);
  const { error } = await adminClient.from("whatsapp_otps").insert({
    mobile,
    otp,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  return error;
}

async function sendWhatsAppTemplate(authKey: string, mobile: string, otp: string) {
  const payload = {
    integrated_number: "919211788450",
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: "acry_login_otp",
        language: { code: "en", policy: "deterministic" },
        namespace: "34be867f_2430_42e1_bcd8_1831c618f724",
        to_and_components: [{
          to: [mobile],
          components: {
            body_1: { type: "text", value: otp },
            button_1: { subtype: "url", type: "text", value: otp },
          },
        }],
      },
    },
  };

  const resp = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: authKey },
    body: JSON.stringify(payload),
  });
  const rawText = await resp.text();
  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[MSG91] WhatsApp API returned non-JSON:", rawText.slice(0, 500));
    data = { type: resp.ok ? "success" : "error", message: rawText.slice(0, 200), raw: true };
  }
  console.log("[MSG91] WhatsApp template response:", JSON.stringify(data));
  return data;
}

// ─── User Creation / Lookup ──────────────────────────────

async function findOrCreateUserAndGenerateLink(adminClient: ReturnType<typeof getAdminClient>, normalizedMobile: string) {
  const phoneE164 = `+${normalizedMobile}`;
  const placeholderEmail = `${normalizedMobile}@phone.acry.ai`;

  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.phone === phoneE164 || u.phone === normalizedMobile
  );

  if (existingUser) {
    const { data: sessionData, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: existingUser.email || placeholderEmail,
    });
    if (error) throw error;

    const tokenHash = sessionData.properties?.hashed_token;
    if (!tokenHash) throw new Error("Magic link generation failed");

    return {
      isNewUser: false,
      userId: existingUser.id,
      email: existingUser.email,
      token_hash: tokenHash,
      verification_type: "magiclink" as const,
    };
  }

  await cleanupStalePhoneSignupData(adminClient, normalizedMobile);

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    phone: phoneE164,
    email: placeholderEmail,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      phone: phoneE164,
      signup_method: "mobile_otp",
      display_name: `User${normalizedMobile.slice(-4)}`,
    },
  });

  if (createError) throw createError;

  const { data: sessionData, error: sessionError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: placeholderEmail,
  });
  if (sessionError) throw sessionError;

  const tokenHash = sessionData.properties?.hashed_token;
  if (!tokenHash) throw new Error("Magic link generation failed");

  return {
    isNewUser: true,
    userId: newUser.user.id,
    token_hash: tokenHash,
    verification_type: "magiclink" as const,
  };
}

// ─── Action Handlers ─────────────────────────────────────

async function handleSendSMS(authKey: string, templateId: string, mobile: string) {
  const { data, ok } = await msg91SendOTP(authKey, templateId, mobile);
  if (!(data.type === "success" || ok)) {
    return json({ error: data.message || "Failed to send OTP", details: data }, 400);
  }
  return json({ success: true, message: "OTP sent via SMS", channel: "sms" });
}

async function handleSendWhatsApp(authKey: string, mobile: string) {
  const otp = generateOTP4();
  const adminClient = getAdminClient();

  const storeErr = await storeWhatsAppOTP(adminClient, mobile, otp);
  if (storeErr) {
    console.error("[MSG91] Failed to store WhatsApp OTP:", storeErr);
    return json({ error: "Failed to generate OTP" }, 500);
  }

  await sendWhatsAppTemplate(authKey, mobile, otp);
  return json({ success: true, message: "OTP sent via WhatsApp only", channel: "whatsapp" });
}

async function handleVerify(authKey: string, mobile: string, otp: string | undefined) {
  if (!otp || otp.length !== 4) {
    return json({ error: "Invalid OTP" }, 400);
  }

  const adminClient = getAdminClient();

  // Check WhatsApp OTP in DB first
  const { data: waOtp } = await adminClient
    .from("whatsapp_otps")
    .select("*")
    .eq("mobile", mobile)
    .eq("otp", otp)
    .eq("verified", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let otpVerified = false;

  if (waOtp) {
    await adminClient.from("whatsapp_otps").update({ verified: true }).eq("id", waOtp.id);
    otpVerified = true;
    console.log("[MSG91] WhatsApp OTP verified from DB");
  } else {
    // Fallback to MSG91 SMS verify (per docs: GET with authkey header)
    const { data } = await msg91VerifyOTP(authKey, mobile, otp);
    otpVerified = data.type === "success";
  }

  if (otpVerified) {
    const userResult = await findOrCreateUserAndGenerateLink(adminClient, mobile);
    const apiKey = await issueUserApiKey(adminClient, userResult.userId, {
      name: "Mobile OTP API Key",
      permissions: ["user_api"],
      rateLimitPerMinute: 120,
    });

    return json({ success: true, verified: true, api_key: apiKey, ...userResult });
  }

  return json({ success: false, verified: false, error: "OTP verification failed" }, 400);
}

async function handleResendSMS(authKey: string, mobile: string) {
  const { data } = await msg91ResendOTP(authKey, mobile, "text");
  return json({
    success: data.type === "success",
    message: data.message || (data.type === "success" ? "OTP resent via SMS" : "Failed to resend"),
    channel: "sms",
  });
}

async function handleResendWhatsApp(authKey: string, mobile: string) {
  const otp = generateOTP4();
  const adminClient = getAdminClient();

  await storeWhatsAppOTP(adminClient, mobile, otp);
  await sendWhatsAppTemplate(authKey, mobile, otp);

  return json({ success: true, message: "OTP resent via WhatsApp only", channel: "whatsapp" });
}

// ─── Main Handler ────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const decodedPath = decodeURIComponent(url.pathname);
    const bodyPayload = await parseBody(req);
    const { action, mobile, otp } = extractParams(req, url, decodedPath, bodyPayload);

    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_TEMPLATE_ID");

    if (!authKey || !templateId) {
      return json({ error: "MSG91 not configured" }, 500);
    }

    const normalizedMobile = normalizeIndianMobile(mobile);
    if (!normalizedMobile) {
      console.warn("[MSG91] Mobile parse failed", { action, mobile, method: req.method, url: req.url });
      return json({ error: "Invalid mobile number. Use Indian format like 9876543210 or 919876543210" }, 400);
    }

    switch (action) {
      case "send":
        return await handleSendSMS(authKey, templateId, normalizedMobile);
      case "send_whatsapp":
        return await handleSendWhatsApp(authKey, normalizedMobile);
      case "verify":
        return await handleVerify(authKey, normalizedMobile, otp);
      case "resend":
        return await handleResendSMS(authKey, normalizedMobile);
      case "resend_whatsapp":
        return await handleResendWhatsApp(authKey, normalizedMobile);
      default:
        return json({ error: "Invalid action. Use: send, send_whatsapp, verify, resend, resend_whatsapp" }, 400);
    }
  } catch (err) {
    console.error("[MSG91] Error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
