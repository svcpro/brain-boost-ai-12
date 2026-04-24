// SMS Notify — MSG91 transactional sender with quota, templates, fallback
// Actions: send | broadcast | preview | quota | retry
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function normalizeMobile(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  const cleaned = digits.startsWith("00") ? digits.slice(2) : digits;
  if (/^\d{10}$/.test(cleaned)) return `91${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `91${cleaned.slice(1)}`;
  if (/^91\d{10}$/.test(cleaned)) return cleaned;
  if (/^\d{11,15}$/.test(cleaned)) return cleaned;
  return null;
}

function renderTemplate(tpl: string, vars: Record<string, unknown>): string {
  const normalizedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars || {})) {
    const stringValue = value == null ? "" : String(value);
    normalizedVars[key] = stringValue;
    normalizedVars[key.toLowerCase()] = stringValue;
  }

  if (normalizedVars.link && !normalizedVars.url) normalizedVars.url = normalizedVars.link;
  if (normalizedVars.url && !normalizedVars.link) normalizedVars.link = normalizedVars.url;

  return tpl
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => normalizedVars[k] ?? normalizedVars[k.toLowerCase()] ?? "")
    .replace(/##\s*(\w+)\s*##/g, (_m, k) => normalizedVars[k] ?? normalizedVars[k.toLowerCase()] ?? "")
    .replace(/\{#\s*(\w+)\s*#\}/g, (_m, k) => normalizedVars[k] ?? normalizedVars[k.toLowerCase()] ?? "");
}

async function sendViaMsg91(
  mobile: string,
  message: string,
  cfg: {
    sender_id: string;
    route: string;
    country: string;
    dlt_template_id?: string | null;
    variables?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; request_id?: string; error?: string; raw?: any }> {
  const key = Deno.env.get("MSG91_AUTH_KEY");
  if (!key) return { ok: false, error: "MSG91_AUTH_KEY not configured" };

  // Use MSG91 Flow API (transactional) — falls back to legacy sendsms if no DLT
  const useFlow = !!cfg.dlt_template_id;

  if (useFlow) {
    // MSG91 Flow API requires variables as named fields on the recipient object
    // (matching the variable names registered in the DLT template / Flow).
    // Both lowercase and UPPERCASE/VAR1..N are included for maximum compatibility.
    const recipient: Record<string, unknown> = { mobiles: mobile };
    const vars = { ...(cfg.variables || {}) };
    if (vars.link != null && vars.url == null) vars.url = vars.link;
    if (vars.url != null && vars.link == null) vars.link = vars.url;

    let idx = 1;
    for (const [k, v] of Object.entries(vars)) {
      const val = v == null ? "" : String(v);
      recipient[k] = val;
      recipient[k.toUpperCase()] = val;
      recipient[`VAR${idx}`] = val;
      recipient[`var${idx}`] = val;
      idx++;
    }

    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        template_id: cfg.dlt_template_id,
        short_url: "0",
        recipients: [recipient],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.type === "error") {
      return { ok: false, error: data?.message || `HTTP ${res.status}`, raw: data };
    }
    return { ok: true, request_id: data?.request_id || data?.message || null, raw: data };
  }

  // Legacy v2 sendsms fallback
  const url = new URL("https://api.msg91.com/api/v2/sendsms");
  const res = await fetch(url, {
    method: "POST",
    headers: { authkey: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: cfg.sender_id,
      route: cfg.route,
      country: cfg.country,
      sms: [{ message, to: [mobile] }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.type === "error") {
    return { ok: false, error: data?.message || `HTTP ${res.status}`, raw: data };
  }
  return { ok: true, request_id: data?.message || data?.request_id, raw: data };
}

async function dispatchSms(
  sb: any,
  params: {
    user_id?: string | null;
    mobile?: string | null;
    template_name?: string | null;
    body?: string | null;
    variables?: Record<string, unknown>;
    category?: string;
    priority?: string;
    source?: string;
  }
): Promise<{ ok: boolean; status: string; reason?: string; message_id?: string; fallback?: boolean }> {
  // Load config
  const { data: cfg } = await sb.from("sms_config").select("*").limit(1).maybeSingle();
  if (!cfg) return { ok: false, status: "config_missing", reason: "sms_config row not found" };
  if (!cfg.is_enabled) return { ok: false, status: "disabled", reason: "SMS globally disabled" };

  // Resolve recipient
  let mobile = params.mobile ? normalizeMobile(params.mobile) : null;
  let user_id = params.user_id || null;
  if (!mobile && user_id) {
    const { data: prof } = await sb.from("profiles").select("phone").eq("id", user_id).maybeSingle();
    mobile = normalizeMobile(prof?.phone);
  }
  if (!mobile) return { ok: false, status: "invalid_mobile", reason: "Could not resolve mobile" };

  // Resolve template / body
  let body = params.body || "";
  let category = params.category || "engagement";
  let dltId: string | null = cfg.default_dlt_template_id || null;
  let senderId = cfg.sender_id;
  let mergedVars: Record<string, unknown> = { ...(params.variables || {}) };

  if (params.template_name) {
    const { data: tpl } = await sb
      .from("sms_templates").select("*").eq("name", params.template_name).maybeSingle();
    if (!tpl) return { ok: false, status: "template_missing", reason: `Template ${params.template_name} not found` };
    if (!tpl.is_active) return { ok: false, status: "template_disabled", reason: "Template inactive" };
    // Auto-inject {{link}} from template's target_url if caller didn't provide one
    if (tpl.target_url && (mergedVars.link == null || mergedVars.link === "")) {
      mergedVars.link = tpl.target_url;
    }
    body = renderTemplate(tpl.body_template, mergedVars);
    category = tpl.category || category;
    dltId = tpl.dlt_template_id || dltId;
    senderId = tpl.sender_id || senderId;
  }
  if (!body) return { ok: false, status: "empty_body", reason: "No template or body provided" };

  // Category gate
  const allowed: string[] = cfg.allowed_categories || [];
  if (allowed.length && !allowed.includes(category)) {
    return { ok: false, status: "category_blocked", reason: `Category ${category} not allowed` };
  }

  // Quota check (criticals bypass)
  const isCritical = (cfg.critical_categories || []).includes(category);
  if (user_id && !isCritical) {
    const { data: rem } = await sb.rpc("sms_quota_remaining", { p_user_id: user_id });
    if (typeof rem === "number" && rem <= 0) {
      // Log blocked
      await sb.from("sms_messages").insert({
        user_id, to_number: mobile, message_body: body, template_name: params.template_name,
        template_params: params.variables || {}, category, priority: params.priority || "medium",
        status: "blocked_quota", source: params.source || "manual",
        error_code: "QUOTA_EXCEEDED", error_message: "Monthly SMS quota exceeded",
      });

      // Auto-fallback
      if (cfg.auto_fallback_on_quota_exceeded && (cfg.fallback_channels || []).length) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/omnichannel-notify`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event_type: "sms_quota_fallback",
              user_id,
              title: params.variables?.title || "ACRY",
              body,
              data: { channels: cfg.fallback_channels, category },
            }),
          });
        } catch { /* ignore */ }
        return { ok: true, status: "fallback", fallback: true, reason: "quota_exceeded" };
      }
      return { ok: false, status: "quota_exceeded", reason: "Monthly limit reached" };
    }
  }

  // Send
  const result = await sendViaMsg91(mobile, body, {
    sender_id: senderId,
    route: cfg.default_route,
    country: cfg.default_country,
    dlt_template_id: dltId,
    variables: mergedVars,
  });

  // Log
  const { data: logRow } = await sb.from("sms_messages").insert({
    user_id, to_number: mobile, message_body: body, template_name: params.template_name,
    template_params: params.variables || {}, category, priority: params.priority || "medium",
    status: result.ok ? "sent" : "failed",
    msg91_request_id: result.request_id || null,
    error_message: result.error || null,
    source: params.source || "manual",
    delivered_at: result.ok ? new Date().toISOString() : null,
  }).select("id").maybeSingle();

  // Quota increment on success
  if (result.ok && user_id && !isCritical) {
    await sb.rpc("sms_quota_increment", { p_user_id: user_id });
  }

  return {
    ok: result.ok,
    status: result.ok ? "sent" : "failed",
    reason: result.error,
    message_id: logRow?.id,
    msg91_request_id: result.request_id,
    dlt_missing: !dltId,
    warning: !dltId ? "No DLT template ID configured — Indian carriers may silently drop this message even though MSG91 accepted it. Add DLT IDs in Bulk DLT Editor." : undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = admin();
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = body.action || url.searchParams.get("action") || "send";

    if (action === "send") {
      const r = await dispatchSms(sb, body);
      return json(r, r.ok ? 200 : 400);
    }

    if (action === "preview") {
      const { data: tpl } = await sb.from("sms_templates").select("*")
        .eq("name", body.template_name).maybeSingle();
      if (!tpl) return json({ error: "Template not found" }, 404);
      const rendered = renderTemplate(tpl.body_template, body.variables || {});
      return json({ rendered, length: rendered.length, segments: Math.ceil(rendered.length / 160) });
    }

    if (action === "quota") {
      const { data: rem } = await sb.rpc("sms_quota_remaining", { p_user_id: body.user_id });
      const { data: q } = await sb.from("sms_quota").select("*").eq("user_id", body.user_id).maybeSingle();
      return json({ remaining: rem ?? 0, used: q?.count ?? 0, limit: q?.monthly_limit ?? 60, last_sent_at: q?.last_sent_at });
    }

    if (action === "delivery_status") {
      // Query MSG91 for actual delivery status using request_id
      const key = Deno.env.get("MSG91_AUTH_KEY");
      if (!key) return json({ error: "MSG91_AUTH_KEY not configured" }, 500);
      const reqId = body.request_id || body.msg91_request_id;
      if (!reqId) return json({ error: "request_id required" }, 400);
      try {
        const res = await fetch(`https://control.msg91.com/api/v5/report/logs/p/sms?requestId=${reqId}`, {
          method: "GET",
          headers: { authkey: key, accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        // Update local log if delivery info present
        const reportData = data?.data?.[0] || data?.[0] || data;
        const dlrStatus = reportData?.status || reportData?.deliveryStatus;
        if (dlrStatus && body.message_id) {
          await sb.from("sms_messages").update({
            status: String(dlrStatus).toLowerCase().includes("deliver") ? "delivered" :
                    String(dlrStatus).toLowerCase().includes("fail") || String(dlrStatus).toLowerCase().includes("reject") ? "failed" : "sent",
            error_message: reportData?.description || reportData?.failureReason || null,
            delivered_at: String(dlrStatus).toLowerCase().includes("deliver") ? new Date().toISOString() : null,
          }).eq("id", body.message_id);
        }
        return json({ ok: true, raw: data, status: dlrStatus });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Failed to fetch DLR" }, 500);
      }
    }

    if (action === "retry") {
      const { data: msg } = await sb.from("sms_messages").select("*").eq("id", body.message_id).maybeSingle();
      if (!msg) return json({ error: "Message not found" }, 404);
      const r = await dispatchSms(sb, {
        user_id: msg.user_id, mobile: msg.to_number, body: msg.message_body,
        category: msg.category, priority: msg.priority, source: "retry",
      });
      return json(r, r.ok ? 200 : 400);
    }

    if (action === "broadcast") {
      // body: { template_name, variables, audience_type, audience_user_ids[], audience_filters }
      let users: { id: string; phone: string | null }[] = [];
      if (body.audience_type === "specific" && Array.isArray(body.audience_user_ids)) {
        const { data } = await sb.from("profiles").select("id, phone").in("id", body.audience_user_ids);
        users = data || [];
      } else {
        const { data } = await sb.from("profiles").select("id, phone").not("phone", "is", null).limit(5000);
        users = data || [];
      }

      let sent = 0, failed = 0, blocked = 0;
      for (const u of users) {
        const r = await dispatchSms(sb, {
          user_id: u.id, mobile: u.phone, template_name: body.template_name,
          variables: body.variables || {}, source: "broadcast",
        });
        if (r.ok && r.status === "sent") sent++;
        else if (r.status === "quota_exceeded" || r.status === "fallback") blocked++;
        else failed++;
      }
      return json({ ok: true, total: users.length, sent, failed, blocked });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("sms-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
