import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildAuthEmail(type: "confirm" | "reset", userName: string, actionUrl: string) {
  const year = new Date().getFullYear();
  const isConfirm = type === "confirm";

  const title = isConfirm ? "Confirm Your Email" : "Reset Your Password";
  const subtitle = isConfirm
    ? "One quick step to activate your AI Second Brain"
    : "You requested a password reset";
  const bodyText = isConfirm
    ? `<p>Thanks for signing up for <strong style="color:#2dd4bf;">ACRY</strong>! Please confirm your email address to get started.</p>`
    : `<p>We received a request to reset your password. Click the button below to set a new password. If you didn't request this, you can safely ignore this email.</p>`;
  const ctaText = isConfirm ? "Verify Email →" : "Reset Password →";
  const footerNote = isConfirm
    ? "If you didn't create an account, you can safely ignore this email."
    : "This link expires in 1 hour. If you didn't request a password reset, no action is needed.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#111b2e;border-radius:20px;overflow:hidden;border:1px solid rgba(45,212,191,0.15);box-shadow:0 8px 40px rgba(0,0,0,0.4),0 0 80px rgba(13,148,136,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0d9488 0%,#065f46 50%,#064e3b 100%);padding:44px 36px;text-align:center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.2);border-radius:16px;display:inline-block;line-height:56px;font-size:28px;font-weight:900;color:#fff;margin-bottom:14px;">A</div>
            </td></tr>
            <tr><td align="center">
              <h1 style="color:#ffffff;margin:0 0 4px;font-size:30px;font-weight:800;letter-spacing:-0.5px;">ACRY</h1>
              <p style="color:#a7f3d0;margin:0;font-size:11px;text-transform:uppercase;letter-spacing:3px;font-weight:600;">AI Second Brain</p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:36px 36px 8px;text-align:center;">
          <div style="width:10px;height:10px;background:${isConfirm ? '#818cf8' : '#fbbf24'};border-radius:50%;display:inline-block;margin-bottom:16px;box-shadow:0 0 12px ${isConfirm ? '#818cf880' : '#fbbf2480'};"></div>
          <h2 style="color:#f1f5f9;margin:0 0 8px;font-size:24px;font-weight:700;line-height:1.3;">${title}</h2>
          <p style="color:#94a3b8;margin:0;font-size:14px;line-height:1.5;">${subtitle}</p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 36px;">
          <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(45,212,191,0.2),transparent);margin:16px 0;"></div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:8px 36px 24px;">
          <p style="color:#e2e8f0;font-size:15px;line-height:1.8;margin:0 0 8px;">Hi <strong style="color:#2dd4bf;">${userName}</strong>,</p>
          <div style="color:#cbd5e1;font-size:15px;line-height:1.8;">${bodyText}</div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:8px 36px 36px;text-align:center;">
          <a href="${actionUrl}" style="background:linear-gradient(135deg,#0d9488,#0f766e);color:#ffffff;padding:16px 48px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;box-shadow:0 4px 20px rgba(13,148,136,0.4),0 0 40px rgba(13,148,136,0.15);letter-spacing:0.3px;border:1px solid rgba(167,243,208,0.2);">${ctaText}</a>
        </td></tr>

        <!-- Footer Note -->
        <tr><td style="padding:0 36px 28px;">
          <div style="background:rgba(45,212,191,0.06);border-radius:12px;padding:16px 20px;border:1px solid rgba(45,212,191,0.12);">
            <p style="color:#94a3b8;font-size:13px;margin:0;line-height:1.6;">${footerNote}</p>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:rgba(10,22,40,0.6);padding:28px 36px;text-align:center;border-top:1px solid rgba(45,212,191,0.1);">
          <p style="color:#475569;font-size:12px;margin:0 0 10px;font-weight:500;">© ${year} ACRY · AI Second Brain for All Exams</p>
          <p style="margin:0;">
            <a href="https://acry.ai" style="color:#0d9488;font-size:11px;text-decoration:none;font-weight:600;margin:0 10px;">Website</a>
            <a href="https://acry.ai/support" style="color:#0d9488;font-size:11px;text-decoration:none;font-weight:600;margin:0 10px;">Support</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { type, email, user_id, redirect_to } = await req.json();

    if (!type || !email) {
      return new Response(JSON.stringify({ error: "type and email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user display name
    let userName = email.split("@")[0];
    if (user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user_id)
        .maybeSingle();
      if (profile?.display_name) userName = profile.display_name;
    }

    // Use the app's published URL as the brand redirect base
    const BRAND_URL = "https://brain-boost-ai-12.lovable.app";
    let actionUrl = "";

    if (type === "confirm") {
      const finalRedirect = redirect_to || `${BRAND_URL}/app`;
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "signup",
        email,
        options: { redirectTo: finalRedirect },
      });
      if (error) throw error;
      // The generated action_link points to Supabase auth endpoint — keep it as-is
      // because Supabase needs to verify the token, then it redirects to our brand URL
      actionUrl = data?.properties?.action_link || finalRedirect;
    } else if (type === "reset") {
      const finalRedirect = redirect_to || `${BRAND_URL}/reset-password`;
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: finalRedirect },
      });
      if (error) throw error;
      actionUrl = data?.properties?.action_link || finalRedirect;
    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use 'confirm' or 'reset'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = type === "confirm"
      ? "✉️ Confirm Your ACRY Account"
      : "🔑 Reset Your ACRY Password";

    const html = buildAuthEmail(type, userName, actionUrl);

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ACRY <brain@acry.ai>",
        to: [email],
        subject,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Failed to send email", details: result }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track usage
    supabase.rpc("increment_api_usage", { p_service_name: "resend" }).then(() => {}).catch(() => {});

    console.log(`Branded ${type} email sent to ${email}`);
    return new Response(JSON.stringify({ success: true, type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-branded-auth-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
