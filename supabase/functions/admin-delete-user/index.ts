import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Create anon client to verify the caller
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await anonClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller has admin role
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = roles?.some((r: any) => r.role === "super_admin");
    const isApiAdmin = roles?.some((r: any) => r.role === "api_admin");
    const canDelete = isSuperAdmin || isApiAdmin;

    if (!canDelete) {
      return new Response(JSON.stringify({ error: "Forbidden: Only super_admin or api_admin can delete users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();

    if (!target_user_id || typeof target_user_id !== "string") {
      return new Response(JSON.stringify({ error: "target_user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent deleting yourself
    if (target_user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if target is a super_admin (only super_admin can delete super_admin)
    const { data: targetRoles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", target_user_id);

    const targetIsSuperAdmin = targetRoles?.some((r: any) => r.role === "super_admin");

    if (targetIsSuperAdmin && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Only super admins can delete other super admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the action before deletion
    await serviceClient.from("admin_audit_logs").insert({
      admin_id: caller.id,
      action: "user_deleted",
      target_type: "user",
      target_id: target_user_id,
      details: { deleted_by: caller.id },
    });

    // Delete user from auth (cascades to profiles and other FK-referenced tables)
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(target_user_id);

    if (deleteError) {
      console.error("Delete user error:", JSON.stringify(deleteError));
      return new Response(JSON.stringify({ error: deleteError.message, details: deleteError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
