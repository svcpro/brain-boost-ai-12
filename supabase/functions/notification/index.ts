import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, api-key, x-api-token, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
    // Extract sub-route: e.g. "list", "read", "count"
    const subRoute = pathSegments.find(s => !["functions", "v1", "notification"].includes(s)) || "list";

    // Parse body
    let body: Record<string, any> = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        const raw = await req.text();
        if (raw.trim()) body = JSON.parse(raw);
      } catch { /* empty body is fine */ }
    }

    // Resolve user_id from body or auth
    let userId = body.user_id || null;

    if (!userId) {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "").trim();
        const { data } = await adminClient.auth.getUser(token);
        if (data?.user?.id) userId = data.user.id;
      }
    }

    if (!userId) {
      // Try API key resolution
      const apiKey = req.headers.get("x-api-key") || req.headers.get("api-key") || "";
      if (apiKey && apiKey.startsWith("acry_")) {
        const prefix = `${apiKey.substring(0, 10)}...`;
        const { data: keyRow } = await adminClient
          .from("api_keys")
          .select("created_by")
          .eq("key_prefix", prefix)
          .eq("is_active", true)
          .maybeSingle();
        if (keyRow?.created_by) userId = keyRow.created_by;
      }
    }

    if (!userId) {
      return json({ success: false, error: "Unauthorized", data: null }, 401);
    }

    // ─── Route Handler ───
    switch (subRoute) {
      case "list":
        return await handleList(userId, body);

      case "read":
        return await handleMarkRead(userId, body);

      case "read-all":
        return await handleMarkAllRead(userId);

      case "count":
        return await handleUnreadCount(userId);

      case "delete":
        return await handleDelete(userId, body);

      default:
        return await handleList(userId, body);
    }
  } catch (e) {
    console.error("notification error:", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Unknown error", data: null }, 500);
  }
});

// ─── List Notifications ───
async function handleList(userId: string, body: Record<string, any>) {
  const page = Math.max(1, Number(body.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(body.limit) || 20));
  const offset = (page - 1) * limit;
  const type = body.type || null; // optional filter
  const unreadOnly = body.unread_only === true;

  let query = adminClient
    .from("notification_history")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("type", type);
  if (unreadOnly) query = query.eq("read", false);

  const { data: notifications, count, error } = await query;

  if (error) {
    console.error("notification list error:", error);
    return json({ success: false, error: error.message, data: null }, 500);
  }

  // Get unread count
  const { count: unreadCount } = await adminClient
    .from("notification_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  const items = (notifications || []).map((n: any) => ({
    id: n.id || "",
    title: n.title || "",
    body: n.body || "",
    type: n.type || "general",
    read: n.read ?? false,
    priority: n.priority || "normal",
    action_url: n.action_url || "",
    created_at: n.created_at || "",
  }));

  return json({
    success: true,
    data: {
      notifications: items,
      total: count || 0,
      unread_count: unreadCount || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    },
  });
}

// ─── Mark Single as Read ───
async function handleMarkRead(userId: string, body: Record<string, any>) {
  const notificationId = body.notification_id || body.id;
  if (!notificationId) {
    return json({ success: false, error: "notification_id is required", data: null }, 400);
  }

  const { error } = await adminClient
    .from("notification_history")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    return json({ success: false, error: error.message, data: null }, 500);
  }

  return json({ success: true, data: { marked: 1 } });
}

// ─── Mark All as Read ───
async function handleMarkAllRead(userId: string) {
  const { error, count } = await adminClient
    .from("notification_history")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    return json({ success: false, error: error.message, data: null }, 500);
  }

  return json({ success: true, data: { marked: count || 0 } });
}

// ─── Unread Count ───
async function handleUnreadCount(userId: string) {
  const { count, error } = await adminClient
    .from("notification_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    return json({ success: false, error: error.message, data: null }, 500);
  }

  return json({ success: true, data: { unread_count: count || 0 } });
}

// ─── Delete Notification ───
async function handleDelete(userId: string, body: Record<string, any>) {
  const notificationId = body.notification_id || body.id;
  if (!notificationId) {
    return json({ success: false, error: "notification_id is required", data: null }, 400);
  }

  const { error } = await adminClient
    .from("notification_history")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    return json({ success: false, error: error.message, data: null }, 500);
  }

  return json({ success: true, data: { deleted: 1 } });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
