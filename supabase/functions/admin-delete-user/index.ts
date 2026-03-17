import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildPhoneVariants(rawPhone: unknown): string[] {
  const phone = typeof rawPhone === "string" ? rawPhone.trim() : "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return [];

  const localMobile = digits.length > 10 ? digits.slice(-10) : digits;
  return [...new Set([phone, digits, localMobile, `+${digits}`].filter(Boolean))];
}

async function findAuthUserByIdentifiers(
  serviceClient: ReturnType<typeof createClient>,
  targetUserId: string | null,
  targetPhone: string | null,
  targetEmail: string | null,
) {
  if (targetUserId) {
    const { data, error } = await serviceClient.auth.admin.getUserById(targetUserId);
    if (!error && data.user) {
      return {
        user: data.user,
        resolvedUserId: data.user.id,
        resolvedPhone: data.user.phone ?? targetPhone,
        resolvedEmail: data.user.email ?? targetEmail,
      };
    }
  }

  if (!targetPhone && !targetEmail) {
    return {
      user: null,
      resolvedUserId: targetUserId,
      resolvedPhone: targetPhone,
      resolvedEmail: targetEmail,
    };
  }

  const { data: usersData, error: listUsersError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listUsersError) {
    throw new Error(`Failed to resolve auth user by identifier: ${listUsersError.message}`);
  }

  const phoneVariants = targetPhone ? buildPhoneVariants(targetPhone) : [];
  const emailNeedle = targetEmail?.toLowerCase() ?? "";
  const authUser = usersData.users.find((candidate) => {
    const candidateEmail = candidate.email?.toLowerCase() ?? "";
    const candidatePhones = buildPhoneVariants(candidate.phone ?? "");
    return (emailNeedle && candidateEmail === emailNeedle)
      || phoneVariants.some((variant) => candidatePhones.includes(variant));
  }) ?? null;

  return {
    user: authUser,
    resolvedUserId: authUser?.id ?? targetUserId,
    resolvedPhone: authUser?.phone ?? targetPhone,
    resolvedEmail: authUser?.email ?? targetEmail,
  };
}

async function purgeUserData(
  serviceClient: ReturnType<typeof createClient>,
  seedUserIds: string[],
  targetPhone: unknown,
  targetEmail: string | null | undefined,
) {
  const staleUserIds = new Set<string>(seedUserIds.filter(Boolean));

  for (const phoneVariant of buildPhoneVariants(targetPhone)) {
    const { data: profileRows, error } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("phone", phoneVariant);

    if (error) {
      throw new Error(`Failed to resolve profile cleanup by phone (${phoneVariant}): ${error.message}`);
    }

    profileRows?.forEach((row) => staleUserIds.add(row.id));
  }

  if (targetEmail) {
    const { data: emailRows, error: emailError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", targetEmail);

    if (emailError) {
      throw new Error(`Failed to resolve profile cleanup by email: ${emailError.message}`);
    }

    emailRows?.forEach((row) => staleUserIds.add(row.id));
  }

  const userIds = [...staleUserIds];
  if (userIds.length === 0) {
    throw new Error("No matching user data found to purge");
  }

  const purgeResults = await Promise.allSettled([
    serviceClient.from("topics").delete().in("user_id", userIds),
    serviceClient.from("subjects").delete().in("user_id", userIds),
    serviceClient.from("api_keys").delete().in("created_by", userIds),
    serviceClient.from("user_roles").delete().in("user_id", userIds),
    serviceClient.from("user_settings").delete().in("user_id", userIds),
    serviceClient.from("profiles").delete().in("id", userIds),
  ]);

  const failures: string[] = [];
  for (const result of purgeResults) {
    if (result.status === "rejected") {
      failures.push(String(result.reason));
      continue;
    }
    if (result.value.error?.message) {
      failures.push(result.value.error.message);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to purge deleted user data: ${failures.join("; ")}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

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

    const requestBody = await req.json().catch(() => ({}));
    const targetUserId = typeof requestBody.target_user_id === "string" && requestBody.target_user_id.trim()
      ? requestBody.target_user_id.trim()
      : null;
    const targetEmail = typeof requestBody.target_email === "string" && requestBody.target_email.trim()
      ? requestBody.target_email.trim().toLowerCase()
      : null;
    const targetPhone = typeof requestBody.target_phone === "string" && requestBody.target_phone.trim()
      ? requestBody.target_phone.trim()
      : null;

    if (!targetUserId && !targetEmail && !targetPhone) {
      return new Response(JSON.stringify({ error: "target_user_id, target_email, or target_phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedTarget = await findAuthUserByIdentifiers(
      serviceClient,
      targetUserId,
      targetPhone,
      targetEmail,
    );

    if (resolvedTarget.resolvedUserId === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (resolvedTarget.resolvedUserId) {
      const { data: targetRoles } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", resolvedTarget.resolvedUserId);

      const targetIsSuperAdmin = targetRoles?.some((r: any) => r.role === "super_admin");

      if (targetIsSuperAdmin && !isSuperAdmin) {
        return new Response(
          JSON.stringify({ error: "Only super admins can delete other super admins" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await serviceClient.from("admin_audit_logs").insert({
      admin_id: caller.id,
      action: "user_deleted",
      target_type: "user",
      target_id: resolvedTarget.resolvedUserId,
      details: {
        deleted_by: caller.id,
        phone: resolvedTarget.resolvedPhone,
        email: resolvedTarget.resolvedEmail,
        auth_user_found: !!resolvedTarget.user,
      },
    });

    await purgeUserData(
      serviceClient,
      resolvedTarget.resolvedUserId ? [resolvedTarget.resolvedUserId] : [],
      resolvedTarget.resolvedPhone,
      resolvedTarget.resolvedEmail,
    );

    if (resolvedTarget.user?.id) {
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(resolvedTarget.user.id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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