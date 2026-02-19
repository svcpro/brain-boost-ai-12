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
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

  if (claimsError || !claimsData?.claims) {
    throw new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, ...securityHeaders, "Content-Type": "application/json" } }
    );
  }

  const claims = claimsData.claims;
  return {
    userId: claims.sub as string,
    email: claims.email as string | undefined,
    role: (claims.role as string) || "authenticated",
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
