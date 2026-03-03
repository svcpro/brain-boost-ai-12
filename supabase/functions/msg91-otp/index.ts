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
    if (action === "send" || action === "send_whatsapp") {
      // Step 1: Send OTP via SMS (generates and stores the OTP in MSG91)
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

      // Step 2: If WhatsApp requested, immediately retry via WhatsApp channel
      if (action === "send_whatsapp") {
        const retryUrl = `https://control.msg91.com/api/v5/otp/retry?authkey=${authKey}&retrytype=whatsapp&mobile=${normalizedMobile}`;
        const retryResp = await fetch(retryUrl, { method: "GET" });
        const retryData = await retryResp.json();
        console.log("[MSG91] WhatsApp retry response:", JSON.stringify(retryData));

        return json({
          success: true,
          message: "OTP sent via WhatsApp",
          type: retryData.type,
          channel: "whatsapp",
        });
      }

      return json({ success: true, message: "OTP sent successfully", type: data.type });
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

    /* ═══ RESEND OTP VIA WHATSAPP ═══ */
    if (action === "resend_whatsapp") {
      const url = `https://control.msg91.com/api/v5/otp/retry?authkey=${authKey}&retrytype=whatsapp&mobile=${normalizedMobile}`;
      const resp = await fetch(url, { method: "GET" });
      const data = await resp.json();
      console.log("[MSG91] Resend WhatsApp OTP response:", JSON.stringify(data));

      return json({
        success: data.type === "success",
        message: data.message || (data.type === "success" ? "OTP resent via WhatsApp" : "Failed to resend"),
      });
    }

    return json({ error: "Invalid action. Use: send, verify, resend" }, 400);
  } catch (err) {
    console.error("[MSG91] Error:", err);
    return json({ error: (err as Error).message || "Internal error" }, 500);
  }
});
