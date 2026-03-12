import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function normalizeIndianMobile(rawMobile: unknown): string | null {
  if (rawMobile === null || rawMobile === undefined) return null;

  const raw = typeof rawMobile === "string" || typeof rawMobile === "number"
    ? String(rawMobile)
    : "";

  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return null;

  const withoutIntlPrefix = digitsOnly.startsWith("00")
    ? digitsOnly.slice(2)
    : digitsOnly;

  // 10-digit local number -> convert to 91XXXXXXXXXX
  if (/^\d{10}$/.test(withoutIntlPrefix)) {
    return `91${withoutIntlPrefix}`;
  }

  // 0XXXXXXXXXX -> trim leading 0 and convert
  if (/^0\d{10}$/.test(withoutIntlPrefix)) {
    return `91${withoutIntlPrefix.slice(1)}`;
  }

  // Already with country code 91
  if (/^91\d{10}$/.test(withoutIntlPrefix)) {
    return withoutIntlPrefix;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const decodedPath = decodeURIComponent(url.pathname);
    const embeddedQueryString = decodedPath.includes("?")
      ? decodedPath.split("?").slice(1).join("?")
      : "";
    const embeddedParams = new URLSearchParams(embeddedQueryString);

    let action: string | undefined;
    let mobile: string | undefined;
    let otp: string | undefined;

    // Try JSON body first, fall back to query/path params
    try {
      const body = await req.json();
      action = body.action;
      mobile = body.mobile;
      otp = body.otp;
    } catch {
      // No JSON body — fall through to query/path parsing
    }

    // Merge query params (explicit query has highest priority)
    action = url.searchParams.get("action") || embeddedParams.get("action") || action;
    mobile = url.searchParams.get("mobile") || embeddedParams.get("mobile") || mobile;
    otp = url.searchParams.get("otp") || embeddedParams.get("otp") || otp;

    // Also support action as path segment: /msg91-otp/send, /verify, /resend, etc.
    if (!action) {
      const lastSegment = decodedPath.split("/").filter(Boolean).pop() || "";
      const actionMap: Record<string, string> = {
        send: "send",
        "send-whatsapp": "send_whatsapp",
        verify: "verify",
        resend: "resend",
        "resend-whatsapp": "resend_whatsapp",
      };
      action = actionMap[lastSegment] || action;
    }

    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_TEMPLATE_ID");

    if (!authKey || !templateId) {
      return json({ error: "MSG91 not configured" }, 500);
    }

    const normalizedMobile = normalizeIndianMobile(mobile);
    if (!normalizedMobile) {
      return json({ error: "Invalid mobile number. Use Indian format like 9876543210 or 919876543210" }, 400);
    }

    /* ═══ SEND OTP via SMS ONLY ═══ */
    if (action === "send") {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${normalizedMobile}&authkey=${authKey}&otp_expiry=5&otp_length=4&realTimeResponse=1`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await resp.json();
      console.log("[MSG91] Send SMS OTP response:", JSON.stringify(data));

      if (!(data.type === "success" || resp.ok)) {
        return json({ error: data.message || "Failed to send OTP", details: data }, 400);
      }

      return json({ success: true, message: "OTP sent via SMS", channel: "sms" });
    }

    /* ═══ SEND OTP via WHATSAPP ONLY (no SMS) ═══ */
    if (action === "send_whatsapp") {
      const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
      const adminClient = getAdminClient();

      // Store OTP in database (NOT MSG91 — avoids SMS being sent)
      // First, invalidate any existing OTPs for this number
      await adminClient.from("whatsapp_otps").delete().eq("mobile", normalizedMobile).eq("verified", false);

      const { error: insertErr } = await adminClient.from("whatsapp_otps").insert({
        mobile: normalizedMobile,
        otp: generatedOtp,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      if (insertErr) {
        console.error("[MSG91] Failed to store WhatsApp OTP:", insertErr);
        return json({ error: "Failed to generate OTP" }, 500);
      }

      // Send OTP via WhatsApp template ONLY
      const whatsappPayload = {
        integrated_number: "919211788450",
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "acry_login_otp",
            language: { code: "en", policy: "deterministic" },
            namespace: "34be867f_2430_42e1_bcd8_1831c618f724",
            to_and_components: [
              {
                to: [normalizedMobile],
                components: {
                  body_1: { type: "text", value: generatedOtp },
                  button_1: { subtype: "url", type: "text", value: generatedOtp },
                },
              },
            ],
          },
        },
      };

      const waResp = await fetch(
        "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", authkey: authKey },
          body: JSON.stringify(whatsappPayload),
        }
      );
      const waData = await waResp.json();
      console.log("[MSG91] WhatsApp template response:", JSON.stringify(waData));

      return json({ success: true, message: "OTP sent via WhatsApp only", channel: "whatsapp" });
    }

    /* ═══ VERIFY OTP ═══ */
    if (action === "verify") {
      if (!otp || otp.length !== 4) {
        return json({ error: "Invalid OTP" }, 400);
      }

      const adminClient = getAdminClient();

      // First check if there's a WhatsApp OTP stored in DB
      const { data: waOtp } = await adminClient
        .from("whatsapp_otps")
        .select("*")
        .eq("mobile", normalizedMobile)
        .eq("otp", otp)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let otpVerified = false;

      if (waOtp) {
        // WhatsApp OTP found and matches — mark as verified
        await adminClient.from("whatsapp_otps").update({ verified: true }).eq("id", waOtp.id);
        otpVerified = true;
        console.log("[MSG91] WhatsApp OTP verified from DB");
      } else {
        // Fall back to MSG91 verify (SMS OTP path)
        const url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${normalizedMobile}`;
        const resp = await fetch(url, {
          method: "GET",
          headers: { authkey: authKey },
        });
        const data = await resp.json();
        console.log("[MSG91] SMS OTP verify response:", JSON.stringify(data));
        otpVerified = data.type === "success";
      }

      if (otpVerified) {
        const phoneE164 = `+${normalizedMobile}`;

        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.phone === phoneE164 || u.phone === normalizedMobile
        );

        if (existingUser) {
          const { data: sessionData, error: sessionError } = await adminClient.auth.admin.generateLink({
            type: "magiclink",
            email: existingUser.email || `${normalizedMobile}@phone.acry.ai`,
          });
          if (sessionError) throw sessionError;

          return json({
            success: true,
            verified: true,
            isNewUser: false,
            userId: existingUser.id,
            email: existingUser.email,
            token_hash: sessionData.properties?.hashed_token,
            verification_type: "magiclink",
          });
        } else {
          const placeholderEmail = `${normalizedMobile}@phone.acry.ai`;
          const { data: newUser, error: createError } =
            await adminClient.auth.admin.createUser({
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

          if (createError) {
            console.error("[MSG91] Create user error:", createError);
            return json({ error: createError.message }, 500);
          }

          const { data: sessionData, error: sessionError } = await adminClient.auth.admin.generateLink({
            type: "magiclink",
            email: placeholderEmail,
          });
          if (sessionError) throw sessionError;

          return json({
            success: true,
            verified: true,
            isNewUser: true,
            userId: newUser.user.id,
            token_hash: sessionData.properties?.hashed_token,
            verification_type: "magiclink",
          });
        }
      }

      return json({ success: false, verified: false, error: "OTP verification failed" }, 400);
    }

    /* ═══ RESEND SMS OTP ═══ */
    if (action === "resend") {
      const url = `https://control.msg91.com/api/v5/otp/retry?authkey=${authKey}&retrytype=text&mobile=${normalizedMobile}`;
      const resp = await fetch(url, { method: "GET" });
      const data = await resp.json();
      console.log("[MSG91] Resend SMS OTP response:", JSON.stringify(data));

      return json({
        success: data.type === "success",
        message: data.message || (data.type === "success" ? "OTP resent via SMS" : "Failed to resend"),
        channel: "sms",
      });
    }

    /* ═══ RESEND WHATSAPP OTP (no SMS) ═══ */
    if (action === "resend_whatsapp") {
      const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
      const adminClient = getAdminClient();

      // Invalidate old and store new
      await adminClient.from("whatsapp_otps").delete().eq("mobile", normalizedMobile).eq("verified", false);
      await adminClient.from("whatsapp_otps").insert({
        mobile: normalizedMobile,
        otp: generatedOtp,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

      // Send via WhatsApp template only
      const whatsappPayload = {
        integrated_number: "919211788450",
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "acry_login_otp",
            language: { code: "en", policy: "deterministic" },
            namespace: "34be867f_2430_42e1_bcd8_1831c618f724",
            to_and_components: [
              {
                to: [normalizedMobile],
                components: {
                  body_1: { type: "text", value: generatedOtp },
                  button_1: { subtype: "url", type: "text", value: generatedOtp },
                },
              },
            ],
          },
        },
      };

      await fetch(
        "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", authkey: authKey },
          body: JSON.stringify(whatsappPayload),
        }
      );

      return json({ success: true, message: "OTP resent via WhatsApp only", channel: "whatsapp" });
    }

    return json({ error: "Invalid action. Use: send, send_whatsapp, verify, resend, resend_whatsapp" }, 400);
  } catch (err) {
    console.error("[MSG91] Error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
