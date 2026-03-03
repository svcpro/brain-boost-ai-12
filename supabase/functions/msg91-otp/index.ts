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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, mobile, otp } = await req.json();
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    const templateId = Deno.env.get("MSG91_TEMPLATE_ID");

    if (!authKey || !templateId) {
      return json({ error: "MSG91 not configured" }, 500);
    }

    // Normalize mobile: ensure it has country code
    const normalizedMobile = mobile?.replace(/\s+/g, "").replace(/^\+/, "");
    if (!normalizedMobile || normalizedMobile.length < 10) {
      return json({ error: "Invalid mobile number" }, 400);
    }

    /* ═══ SEND OTP ═══ */
    if (action === "send") {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${normalizedMobile}&authkey=${authKey}&otp_expiry=5&otp_length=4&realTimeResponse=1`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await resp.json();
      console.log("[MSG91] Send OTP response:", JSON.stringify(data));

      if (!(data.type === "success" || resp.ok)) {
        return json({ error: data.message || "Failed to send OTP", details: data }, 400);
      }

      return json({ success: true, message: "OTP sent successfully", type: data.type });
    }

    /* ═══ SEND OTP VIA WHATSAPP (Direct Template API) ═══ */
    if (action === "send_whatsapp") {
      // Generate a 4-digit OTP
      const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));

      // Step 1: Register OTP with MSG91 so verify endpoint works
      const registerUrl = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${normalizedMobile}&authkey=${authKey}&otp=${generatedOtp}&otp_expiry=5&otp_length=4&realTimeResponse=1`;
      const registerResp = await fetch(registerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const registerData = await registerResp.json();
      console.log("[MSG91] Register OTP for WhatsApp:", JSON.stringify(registerData));

      // Step 2: Send OTP via WhatsApp direct template API
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
          headers: {
            "Content-Type": "application/json",
            authkey: authKey,
          },
          body: JSON.stringify(whatsappPayload),
        }
      );
      const waData = await waResp.json();
      console.log("[MSG91] WhatsApp template response:", JSON.stringify(waData));

      return json({
        success: true,
        message: "OTP sent via WhatsApp",
        channel: "whatsapp",
        whatsapp_response: waData,
      });
    }

    /* ═══ VERIFY OTP ═══ */
    if (action === "verify") {
      if (!otp || otp.length !== 4) {
        return json({ error: "Invalid OTP" }, 400);
      }

      const url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${normalizedMobile}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { authkey: authKey },
      });
      const data = await resp.json();
      console.log("[MSG91] Verify OTP response:", JSON.stringify(data));

      if (data.type === "success") {
        // OTP verified — create or sign in user via Supabase Admin
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const phoneE164 = `+${normalizedMobile}`;

        // Check if user exists with this phone
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.phone === phoneE164 || u.phone === normalizedMobile
        );

        let session;

        if (existingUser) {
          // Existing user — generate a magic link / session
          const { data: signInData, error: signInError } =
            await adminClient.auth.admin.generateLink({
              type: "magiclink",
              email: existingUser.email || `${normalizedMobile}@phone.acry.ai`,
            });

          if (signInError) {
            console.error("[MSG91] Sign-in link error:", signInError);
            // Fallback: update user and create session via OTP sign-in
          }

          // Use the token_hash to verify and create session on client side
          // Instead, let's directly create a session using admin
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
          // New user — create with phone
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

          // Generate session link for new user
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

      return json({
        success: false,
        verified: false,
        error: data.message || "OTP verification failed",
      }, 400);
    }

    /* ═══ RESEND OTP ═══ */
    if (action === "resend") {
      const retryType = "text"; // or "voice"
      const url = `https://control.msg91.com/api/v5/otp/retry?authkey=${authKey}&retrytype=${retryType}&mobile=${normalizedMobile}`;
      const resp = await fetch(url, { method: "GET" });
      const data = await resp.json();
      console.log("[MSG91] Resend OTP response:", JSON.stringify(data));

      return json({
        success: data.type === "success",
        message: data.message || (data.type === "success" ? "OTP resent" : "Failed to resend"),
      });
    }

    /* ═══ RESEND OTP VIA WHATSAPP (Direct Template API) ═══ */
    if (action === "resend_whatsapp") {
      // Generate new OTP and re-register with MSG91
      const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));

      const registerUrl = `https://control.msg91.com/api/v5/otp/retry?authkey=${authKey}&retrytype=text&mobile=${normalizedMobile}`;
      await fetch(registerUrl, { method: "GET" });

      // Re-register with specific OTP
      const reRegUrl = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${normalizedMobile}&authkey=${authKey}&otp=${generatedOtp}&otp_expiry=5&otp_length=4&realTimeResponse=1`;
      await fetch(reRegUrl, { method: "POST", headers: { "Content-Type": "application/json" } });

      // Send via WhatsApp template
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
      console.log("[MSG91] Resend WhatsApp template response:", JSON.stringify(waData));

      return json({
        success: true,
        message: "OTP resent via WhatsApp",
        channel: "whatsapp",
      });
    }

    return json({ error: "Invalid action. Use: send, verify, resend" }, 400);
  } catch (err) {
    console.error("[MSG91] Error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
