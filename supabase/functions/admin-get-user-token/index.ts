// Admin-only: Mints a temporary access token (JWT) for a target user.
// Uses Supabase auth.admin.generateLink to obtain a hashed token, then
// verifies it server-side to produce a valid access_token + refresh_token.
//
// Security: Caller MUST be an authenticated admin (any role in user_roles).
// Action is logged to admin_audit_logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) {
      return json({ error: "Missing authorization" }, 401);
    }

    // Validate caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: callerData, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !callerData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = callerData.user.id;

    // Service-role client for admin operations
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller is an admin
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    if (!roles || roles.length === 0) {
      return json({ error: "Forbidden: admin role required" }, 403);
    }

    // Parse target
    const body = await req.json().catch(() => ({}));
    const targetUserId: string = body.user_id;
    if (!targetUserId) return json({ error: "user_id is required" }, 400);

    // Lookup target user (need their email to generate magiclink)
    const { data: targetUserRes, error: targetErr } =
      await admin.auth.admin.getUserById(targetUserId);
    if (targetErr || !targetUserRes?.user) {
      return json({ error: "Target user not found" }, 404);
    }
    const targetEmail = targetUserRes.user.email;
    const targetPhone = targetUserRes.user.phone;

    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let expiresIn: number | null = null;

    if (targetEmail) {
      // Generate a magiclink and exchange the hashed token for a session
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
      });
      if (linkErr || !linkData?.properties?.hashed_token) {
        return json({ error: linkErr?.message || "Failed to generate token" }, 500);
      }

      const verifyClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: verifyData, error: verifyErr } = await verifyClient.auth.verifyOtp({
        type: "magiclink",
        token_hash: linkData.properties.hashed_token,
      });
      if (verifyErr || !verifyData.session) {
        return json({ error: verifyErr?.message || "Failed to verify token" }, 500);
      }
      accessToken = verifyData.session.access_token;
      refreshToken = verifyData.session.refresh_token;
      expiresIn = verifyData.session.expires_in;
    } else {
      return json({
        error: "Target user has no email; token minting via magiclink is unavailable for phone-only accounts.",
      }, 400);
    }

    // Audit log
    await admin.from("admin_audit_logs").insert({
      admin_id: callerId,
      action: "user_access_token_minted",
      target_type: "user",
      target_id: targetUserId,
      details: { email: targetEmail || null, phone: targetPhone || null },
    });

    return json({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      user_id: targetUserId,
      email: targetEmail,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
