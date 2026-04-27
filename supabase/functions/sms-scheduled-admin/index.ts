// Admin-only manager for the sms_scheduled_dispatches queue.
// Actions: list, cancel, resend (re-queue immediately), purge-old.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
function toIstHour(iso: string): number {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).getUTCHours();
}

async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "missing_auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: u } = await sb.auth.getUser(token);
  if (!u?.user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await sb.rpc("is_admin", { _user_id: u.user.id });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden_admin_only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: u.user.id };
}

async function listDispatches(params: URLSearchParams) {
  const status = params.get("status") || "all"; // all | pending | sent | failed | processing | cancelled
  const windowH = Math.min(168, Math.max(1, Number(params.get("window_hours") || "24")));
  const limit = Math.min(500, Math.max(1, Number(params.get("limit") || "200")));

  const sinceIso = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); // 6h backlog
  const untilIso = new Date(Date.now() + windowH * 3600 * 1000).toISOString();

  let q = sb.from("sms_scheduled_dispatches")
    .select("id, user_id, event_key, status, scheduled_for, attempts, last_error, sent_at, created_at, source")
    .gte("scheduled_for", sinceIso)
    .lte("scheduled_for", untilIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (status !== "all") q = q.eq("status", status);

  const { data: rows, error } = await q;
  if (error) return { error: error.message };

  // Hydrate user display names
  const userIds = Array.from(new Set((rows || []).map((r) => r.user_id))).filter(Boolean);
  let profileMap: Record<string, { display_name?: string; phone?: string }> = {};
  if (userIds.length) {
    const { data: profs } = await sb.from("profiles")
      .select("id, display_name, phone")
      .in("id", userIds);
    profileMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
  }

  // Bucket counts by IST hour for "pending" rows in next 24h
  const buckets: Record<number, number> = {};
  for (let h = 0; h < 24; h++) buckets[h] = 0;
  const next24Iso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data: pendingNext24 } = await sb.from("sms_scheduled_dispatches")
    .select("scheduled_for")
    .eq("status", "pending")
    .gte("scheduled_for", new Date().toISOString())
    .lte("scheduled_for", next24Iso)
    .limit(2000);
  for (const r of pendingNext24 || []) {
    const h = toIstHour(r.scheduled_for as string);
    buckets[h] = (buckets[h] || 0) + 1;
  }

  // Status totals (within window)
  const totals = {
    pending: 0, sent: 0, failed: 0, processing: 0, cancelled: 0,
  } as Record<string, number>;
  for (const r of rows || []) totals[r.status] = (totals[r.status] || 0) + 1;

  return {
    ok: true,
    items: (rows || []).map((r) => ({
      ...r,
      ist_hour: toIstHour(r.scheduled_for as string),
      user_name: profileMap[r.user_id]?.display_name || null,
      user_phone: profileMap[r.user_id]?.phone || null,
    })),
    buckets_ist: buckets,
    totals,
  };
}

async function cancelDispatch(id: string) {
  if (!id) return { error: "missing_id" };
  const { data, error } = await sb.from("sms_scheduled_dispatches")
    .update({ status: "cancelled", last_error: "cancelled_by_admin" })
    .eq("id", id)
    .in("status", ["pending", "failed"])
    .select("id, status")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "not_found_or_already_processed" };
  return { ok: true, id: data.id, status: data.status };
}

async function resendDispatch(id: string) {
  if (!id) return { error: "missing_id" };
  // Reset row to pending and bump scheduled_for to "now" so the drainer fires it next tick.
  const { data, error } = await sb.from("sms_scheduled_dispatches")
    .update({
      status: "pending",
      scheduled_for: new Date().toISOString(),
      last_error: null,
      sent_at: null,
    })
    .eq("id", id)
    .select("id, user_id, event_key, payload")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "not_found" };

  // Optionally fire-and-forget the drainer so the user sees an immediate result.
  fetch(`${SUPABASE_URL}/functions/v1/sms-scheduled-drainer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger: "admin_resend", id }),
  }).catch(() => {});

  return { ok: true, id: data.id, status: "requeued" };
}

async function purgeOld(days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { error, count } = await sb.from("sms_scheduled_dispatches")
    .delete({ count: "exact" })
    .lt("created_at", cutoff)
    .in("status", ["sent", "cancelled", "failed"]);
  if (error) return { error: error.message };
  return { ok: true, deleted: count || 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const guard = await requireAdmin(req);
  if (guard instanceof Response) return guard;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";
    let body: any = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = {}; }
    }

    let result: any;
    switch (action) {
      case "list":
        result = await listDispatches(url.searchParams);
        break;
      case "cancel":
        result = await cancelDispatch(body?.id || url.searchParams.get("id") || "");
        break;
      case "resend":
        result = await resendDispatch(body?.id || url.searchParams.get("id") || "");
        break;
      case "purge_old":
        result = await purgeOld(Math.max(1, Math.min(90, Number(body?.days || 7))));
        break;
      default:
        result = { error: `unknown_action:${action}` };
    }

    const status = result?.error ? 400 : 200;
    return new Response(JSON.stringify(result), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sms-scheduled-admin error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
