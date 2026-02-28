import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export interface AuthResult {
  userId: string;
  email: string | undefined;
  role: string;
  supabase: ReturnType<typeof createClient>;
}

/**
 * Authenticate a request using getClaims() for fast JWT validation.
 * Returns userId, email, role, and a scoped supabase client.
 * Throws a Response on failure (catch and return it).
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ error: "Missing or invalid authorization header" }),
      { status: 401, headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  
  // Try fast local JWT validation first, fallback to network call for cold starts
  let userId: string | undefined;
  let email: string | undefined;
  let role = "authenticated";

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

  if (!claimsError && claimsData?.claims?.sub) {
    userId = claimsData.claims.sub as string;
    email = claimsData.claims.email as string | undefined;
    role = (claimsData.claims.role as string) || "authenticated";
  } else {
    // Fallback: network call with retry for transient auth service restarts
    let lastError: any = null;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (!userError && userData?.user) {
        userId = userData.user.id;
        email = userData.user.email;
        role = userData.user.role || "authenticated";
        break;
      }
      lastError = userError;
      console.warn(`[Auth] getUser attempt ${attempt + 1}/${MAX_RETRIES} failed:`, userError?.message);
      if (attempt < MAX_RETRIES - 1) {
        // Exponential backoff: 800ms, 1600ms
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    }

    if (!userId) {
      throw new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return {
    userId: userId!,
    email,
    role,
    supabase,
  };
}

/**
 * Check if user has a specific permission via the role_permissions table.
 * Uses a service-role client to bypass RLS.
 */
export async function checkPermission(userId: string, permissionKey: string): Promise<boolean> {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await adminClient.rpc("has_permission", {
    _user_id: userId,
    _permission: permissionKey,
  });

  return !!data;
}

/**
 * Require a specific permission. Throws a 403 Response if not authorized.
 */
export async function requirePermission(userId: string, permissionKey: string): Promise<void> {
  const allowed = await checkPermission(userId, permissionKey);
  if (!allowed) {
    throw new Response(
      JSON.stringify({ error: "Forbidden: insufficient permissions" }),
      { status: 403, headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Check if user is an admin (has any role in user_roles table).
 */
export async function requireAdmin(userId: string): Promise<void> {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await adminClient.rpc("is_admin", { _user_id: userId });
  if (!data) {
    throw new Response(
      JSON.stringify({ error: "Forbidden: admin access required" }),
      { status: 403, headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Create a standard JSON response with security headers.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Create a standard error response with security headers.
 */
export function errorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Handle CORS preflight with security headers.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, ...securityHeaders } });
  }
  return null;
}
