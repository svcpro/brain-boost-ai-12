import { createClient } from "npm:@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════
   MSG91 OTP Edge Function — v2.1 (updated WhatsApp integration)
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
async function msg91SendOTP(authKey: string, templateId: string, mobile: string, customOtp: string) {
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("otp", customOtp);
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

async function storeWhatsAppOTP(adminClient: ReturnType<typeof getAdminClient>, mobile: string, otp: string, channel: string = "whatsapp") {
  await adminClient.from("whatsapp_otps").delete().eq("mobile", mobile).eq("verified", false);
  const { error } = await adminClient.from("whatsapp_otps").insert({
    mobile,
    otp,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    channel,
  });
  return error;
}

async function sendWhatsAppTemplate(authKey: string, mobile: string, otp: string) {
  const payload = {
    integrated_number: "918796032562",
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: "acry_otp_verify",
        language: { code: "en", policy: "deterministic" },
        namespace: "5a93dcbd_6802_42d5_af95_17d4fd2d7441",
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

// ─── User Session Helpers ────────────────────────────────

async function ensureOtpProfile(
  adminClient: ReturnType<typeof getAdminClient>,
  user: any,
  phoneE164: string,
  fallbackDisplayName: string
) {
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    const updatePayload: Record<string, string> = { phone: phoneE164 };
    if (user.email) updatePayload.email = user.email;

    const { error } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) {
      console.error(`[MSG91] Failed to sync profile for ${user.id}:`, error.message);
    }
    return;
  }

  const { error } = await adminClient.from("profiles").insert({
    id: user.id,
    phone: phoneE164,
    email: user.email ?? null,
    display_name:
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      fallbackDisplayName,
  });

  if (error) {
    console.error(`[MSG91] Failed to create profile for ${user.id}:`, error.message);
  }
}

async function findOrCreateUserAndGenerateLink(adminClient: ReturnType<typeof getAdminClient>, normalizedMobile: string) {
  const phoneE164 = `+${normalizedMobile}`;
  const placeholderEmail = `${normalizedMobile}@phone.acry.ai`;
  const fallbackDisplayName = `User${normalizedMobile.slice(-4)}`;

  let existingUser: any = null;

  // First: exact lookup via profile phone -> auth user id
  const { data: matchedProfile } = await adminClient
    .from("profiles")
    .select("id")
    .or(`phone.eq.${phoneE164},phone.eq.${normalizedMobile}`)
    .limit(1)
    .maybeSingle();

  if (matchedProfile?.id) {
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(matchedProfile.id);
    const authUser = authUserData?.user;

    if (!authUserError && authUser && (
      authUser.phone === phoneE164 ||
      authUser.phone === normalizedMobile ||
      authUser.email === placeholderEmail
    )) {
      existingUser = authUser;
    } else {
      console.warn(`[MSG91] Profile ${matchedProfile.id} did not resolve to a matching auth user for ${phoneE164}`);
    }
  }

  // Fallback: paginate auth users and match exact phone/email values
  if (!existingUser) {
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data: pageData } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (!pageData?.users?.length) break;

      const found = pageData.users.find(
        (u) => u.phone === phoneE164 || u.phone === normalizedMobile || u.email === placeholderEmail
      );

      if (found) {
        existingUser = found;
        break;
      }

      if (pageData.users.length < perPage) break;
      page++;
    }
  }

  if (existingUser) {
    await ensureOtpProfile(adminClient, existingUser, phoneE164, fallbackDisplayName);
    console.log(`[MSG91] Found existing user ${existingUser.id} for phone ${phoneE164}`);

    const { data: sessionData, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: existingUser.email || placeholderEmail,
    });
    if (error) throw error;

    const hashedToken = sessionData.properties?.hashed_token;
    // Store token_hash → userId mapping so downstream APIs resolve the correct user
    if (hashedToken) {
      await adminClient.from("otp_auth_sessions").upsert({
        token_hash: hashedToken,
        user_id: existingUser.id,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      }, { onConflict: "token_hash" }).then(({ error: e }) => {
        if (e) console.error("[MSG91] Failed to store OTP session:", e.message);
      });
    }

    return {
      isNewUser: false,
      userId: existingUser.id,
      email: existingUser.email,
      token_hash: hashedToken,
      verification_type: "magiclink",
    };
  }

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    phone: phoneE164,
    email: placeholderEmail,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      phone: phoneE164,
      signup_method: "mobile_otp",
      display_name: fallbackDisplayName,
    },
  });

  if (createError) throw createError;

  await ensureOtpProfile(adminClient, newUser.user, phoneE164, fallbackDisplayName);

  const { data: sessionData, error: sessionError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: placeholderEmail,
  });
  if (sessionError) throw sessionError;

  const hashedToken = sessionData.properties?.hashed_token;
  // Store token_hash → userId mapping so downstream APIs resolve the correct user
  if (hashedToken) {
    await adminClient.from("otp_auth_sessions").upsert({
      token_hash: hashedToken,
      user_id: newUser.user.id,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    }, { onConflict: "token_hash" }).then(({ error: e }) => {
      if (e) console.error("[MSG91] Failed to store OTP session:", e.message);
    });
  }

  console.log(`[MSG91] Created new user ${newUser.user.id} for phone ${phoneE164}`);
  return {
    isNewUser: true,
    userId: newUser.user.id,
    token_hash: hashedToken,
    verification_type: "magiclink",
  };
}

// ─── Action Handlers ─────────────────────────────────────

async function handleSendSMS(authKey: string, templateId: string, mobile: string) {
  const otp = generateOTP4();
  const adminClient = getAdminClient();

  const { data, ok } = await msg91SendOTP(authKey, templateId, mobile, otp);
  if (!(data.type === "success" || ok)) {
    return json({ error: data.message || "Failed to send OTP", details: data }, 400);
  }

  // Store SMS OTP in database for admin visibility and verification
  try {
    await storeWhatsAppOTP(adminClient, mobile, otp, "sms");
  } catch (e) {
    console.error("[MSG91] Failed to log SMS OTP:", e);
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

  console.log(`[MSG91] Verify attempt: mobile=${mobile}, otp=${otp}`);
  const adminClient = getAdminClient();

  // Check OTP in DB first (covers both SMS and WhatsApp)
  const { data: waOtp, error: dbError } = await adminClient
    .from("whatsapp_otps")
    .select("*")
    .eq("mobile", mobile)
    .eq("otp", otp)
    .eq("verified", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dbError) {
    console.error("[MSG91] DB OTP lookup error:", dbError.message);
  }

  let otpVerified = false;

  if (waOtp) {
    await adminClient.from("whatsapp_otps").update({ verified: true }).eq("id", waOtp.id);
    otpVerified = true;
    console.log("[MSG91] OTP verified from DB");
  } else {
    console.log("[MSG91] OTP not found in DB, trying MSG91 API...");
    // Fallback to MSG91 SMS verify
    const { data } = await msg91VerifyOTP(authKey, mobile, otp);
    otpVerified = data.type === "success" || 
      (data.message && data.message.toLowerCase().includes("already verified"));
  }

  if (otpVerified) {
    const userResult = await findOrCreateUserAndGenerateLink(adminClient, mobile);
    return json({ success: true, verified: true, ...userResult });
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
