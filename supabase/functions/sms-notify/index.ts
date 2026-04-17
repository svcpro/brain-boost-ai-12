// ═══════════════════════════════════════════════════════════
// SMS Notify Edge Function (MSG91 SMS)
// Actions: send | bulk-send | check-quota | execute-scheduled | test
// Quota: configurable per user/month (default 60). Critical messages
// (otp/security/payment) bypass quota. Auto-fallback to push/email.
// ═══════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizeMobile(raw: unknown, country = "91"): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const cleaned = digits.startsWith("00") ? digits.slice(2) : digits;
  if (/^\d{10}$/.test(cleaned)) return `${country}${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `${country}${cleaned.slice(1)}`;
  if (cleaned.startsWith(country) && cleaned.length >= country.length + 10) return cleaned;
  return cleaned.length >= 10 ? cleaned : null;
}

function applyTemplate(body: string, vars: Record<string, unknown>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars[k] ?? ""));
}

interface Config {
  is_enabled: boolean;
  monthly_limit_per_user: number;
  allowed_categories: string[];
  critical_categories: string[];
  fallback_channels: string[];
  auto_fallback_on_quota_exceeded: boolean;
  sender_id: string;
  default_dlt_template_id: string | null;
  default_route: string;
  default_country: string;
}

async function loadConfig(supabase: any): Promise<Config> {
  const { data } = await supabase.from("sms_config").select("*").limit(1).maybeSingle();
  return data ?? {
    is_enabled: true,
    monthly_limit_per_user: 60,
    allowed_categories: ["critical", "transactional", "engagement"],
    critical_categories: ["critical", "otp", "security", "payment"],
    fallback_channels: ["push", "email"],
    auto_fallback_on_quota_exceeded: true,
    sender_id: "ACRYAI",
    default_dlt_template_id: null,
    default_route: "4",
    default_country: "91",
  };
}

async function sendViaMSG91(opts: {
  authKey: string;
  senderId: string;
  route: string;
  dltTemplateId?: string | null;
  mobile: string;
  message: string;
}): Promise<{ ok: boolean; raw: any; requestId?: string; error?: string }> {
  const { authKey, senderId, route, dltTemplateId, mobile, message } = opts;
  const payload: Record<string, any> = {
    sender: senderId,
    route,
    country: 91,
    sms: [{ message, to: [mobile] }],
  };
  if (dltTemplateId) payload.DLT_TE_ID = dltTemplateId;

  try {
    const resp = await fetch("https://api.msg91.com/api/v2/sendsms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let raw: any;
    try { raw = JSON.parse(text); } catch { raw = { type: resp.ok ? "success" : "error", message: text.slice(0, 300) }; }
    const requestId = raw?.request_id || raw?.message;
    const ok = resp.ok && raw?.type !== "error";
    return { ok, raw, requestId, error: ok ? undefined : (raw?.message || "send_failed") };
  } catch (e) {
    return { ok: false, raw: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendFallback(
  supabase: any,
  url: string,
  key: string,
  channels: string[],
  userId: string,
  title: string,
  body: string,
) {
  for (const ch of channels) {
    try {
      if (ch === "push") {
        await fetch(`${url}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ recipient_id: userId, title, body, data: { source: "sms_fallback" } }),
        });
      } else if (ch === "email") {
        await fetch(`${url}/functions/v1/trigger-email`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_key: "general", user_id: userId, variables: { title, body } }),
        });
      }
    } catch (e) {
      console.error(`[sms-notify] fallback ${ch} failed:`, e);
    }
  }
}

async function processOneRecipient(
  supabase: any,
  url: string,
  key: string,
  authKey: string,
  config: Config,
  args: {
    userId?: string;
    phone?: string;
    templateName?: string;
    message?: string;
    category: string;
    priority?: string;
    variables: Record<string, string>;
    source: string;
  },
) {
  const { userId, templateName, category, priority = "medium", variables, source } = args;

  // Resolve phone from profile
  let phone = args.phone;
  if (userId && !phone) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.phone) phone = prof.phone;
  }

  const mobile = normalizeMobile(phone, config.default_country);
  if (!mobile) {
    return { ok: false, blocked: "no_phone" };
  }

  // Category gate
  if (!config.allowed_categories.includes(category)) {
    return { ok: false, blocked: "category_not_allowed" };
  }

  // Load template
  let template: any = null;
  if (templateName) {
    const { data } = await supabase
      .from("sms_templates")
      .select("*")
      .eq("name", templateName)
      .eq("is_active", true)
      .maybeSingle();
    template = data;
  }

  const body = template?.body_template
    ? applyTemplate(template.body_template, variables)
    : (args.message || "");

  if (!body) return { ok: false, blocked: "empty_body" };

  const dltId = template?.dlt_template_id || config.default_dlt_template_id;
  const senderId = template?.sender_id || config.sender_id;
  const isCritical = config.critical_categories.includes(category) || priority === "critical";

  // Quota check (skip for critical)
  let quotaExceeded = false;
  if (userId && !isCritical) {
    const { data: rem } = await supabase.rpc("sms_quota_remaining", { p_user_id: userId });
    if ((rem ?? 0) <= 0) quotaExceeded = true;
  }

  if (quotaExceeded) {
    await supabase.from("sms_messages").insert({
      user_id: userId,
      to_number: mobile,
      message_body: body,
      template_name: templateName || null,
      template_params: variables,
      status: "blocked_quota",
      error_message: "monthly_limit_reached",
      category,
      priority,
      source,
    });

    if (config.auto_fallback_on_quota_exceeded && userId) {
      await sendFallback(supabase, url, key, config.fallback_channels, userId,
        template?.display_name || "ACRY", body);
      return { ok: false, blocked: "quota_exceeded", fallbackSent: true };
    }
    return { ok: false, blocked: "quota_exceeded" };
  }

  // Send
  const result = await sendViaMSG91({
    authKey,
    senderId,
    route: config.default_route,
    dltTemplateId: dltId,
    mobile,
    message: body,
  });

  // Log
  await supabase.from("sms_messages").insert({
    user_id: userId,
    to_number: mobile,
    message_body: body,
    template_name: templateName || null,
    template_params: variables,
    status: result.ok ? "sent" : "failed",
    msg91_request_id: result.requestId || null,
    error_message: result.ok ? null : (result.error || JSON.stringify(result.raw).slice(0, 500)),
    category,
    priority,
    source,
    delivered_at: result.ok ? new Date().toISOString() : null,
  });

  if (result.ok && userId && !isCritical) {
    await supabase.rpc("sms_quota_increment", { p_user_id: userId });
  }

  return { ok: result.ok, requestId: result.requestId, error: result.error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authKey = Deno.env.get("MSG91_AUTH_KEY");
    if (!authKey) return json({ error: "MSG91_AUTH_KEY not configured" }, 500);

    const supabase = createClient(url, key);
    const config = await loadConfig(supabase);

    const reqUrl = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = reqUrl.searchParams.get("action") || body.action || "send";

    if (!config.is_enabled && action !== "check-quota") {
      return json({ error: "SMS notifications globally disabled" }, 403);
    }

    switch (action) {
      case "check-quota": {
        const userId = body.user_id;
        if (!userId) return json({ error: "user_id required" }, 400);
        const { data: rem } = await supabase.rpc("sms_quota_remaining", { p_user_id: userId });
        const { data: q } = await supabase.from("sms_quota").select("*").eq("user_id", userId).maybeSingle();
        return json({
          remaining: rem ?? config.monthly_limit_per_user,
          used: q?.count ?? 0,
          limit: config.monthly_limit_per_user,
          reset_at: q?.reset_at,
        });
      }

      case "send": {
        const { user_id, phone, template_name, message, category = "engagement",
          priority = "medium", variables = {}, source = "manual" } = body;
        if (!template_name && !message) return json({ error: "template_name or message required" }, 400);
        if (!user_id && !phone) return json({ error: "user_id or phone required" }, 400);
        const result = await processOneRecipient(supabase, url, key, authKey, config, {
          userId: user_id, phone, templateName: template_name, message, category, priority, variables, source,
        });
        return json(result);
      }

      case "test": {
        const { phone, message = "ACRY test SMS — all systems operational." } = body;
        if (!phone) return json({ error: "phone required" }, 400);
        const mobile = normalizeMobile(phone, config.default_country);
        if (!mobile) return json({ error: "invalid phone" }, 400);
        const result = await sendViaMSG91({
          authKey,
          senderId: config.sender_id,
          route: config.default_route,
          dltTemplateId: config.default_dlt_template_id,
          mobile,
          message,
        });
        await supabase.from("sms_messages").insert({
          to_number: mobile, message_body: message,
          status: result.ok ? "sent" : "failed",
          msg91_request_id: result.requestId || null,
          error_message: result.ok ? null : result.error,
          category: "test", source: "admin_test",
        });
        return json(result);
      }

      case "bulk-send": {
        const { user_ids = [], template_name, message, category = "engagement",
          priority = "medium", variables = {}, source = "bulk" } = body;
        if (!template_name && !message) return json({ error: "template_name or message required" }, 400);
        if (!Array.isArray(user_ids) || user_ids.length === 0) return json({ error: "user_ids required" }, 400);

        let delivered = 0, failed = 0, blockedQuota = 0, blockedNoPhone = 0, fallbackSent = 0;
        for (const uid of user_ids) {
          const r = await processOneRecipient(supabase, url, key, authKey, config, {
            userId: uid, templateName: template_name, message, category, priority, variables, source,
          });
          if (r.ok) delivered++;
          else if (r.blocked === "quota_exceeded") {
            blockedQuota++;
            if (r.fallbackSent) fallbackSent++;
          } else if (r.blocked === "no_phone") blockedNoPhone++;
          else failed++;
        }
        return json({ total: user_ids.length, delivered, failed,
          blocked_quota: blockedQuota, blocked_no_phone: blockedNoPhone, fallback_sent: fallbackSent });
      }

      case "execute-scheduled": {
        const { data: due } = await supabase
          .from("sms_scheduled_sends")
          .select("*")
          .eq("status", "scheduled")
          .lte("scheduled_at", new Date().toISOString())
          .limit(20);

        const executedIds: string[] = [];
        for (const job of due || []) {
          let userIds: string[] = [];
          if (job.audience_type === "select" && Array.isArray(job.audience_user_ids)) {
            userIds = job.audience_user_ids;
          } else if (job.audience_type === "all") {
            const { data: users } = await supabase.from("profiles")
              .select("id").not("phone", "is", null).limit(2000);
            userIds = (users || []).map((u: any) => u.id);
          }
          let delivered = 0, failed = 0, blockedQuota = 0;
          for (const uid of userIds) {
            const r = await processOneRecipient(supabase, url, key, authKey, config, {
              userId: uid, templateName: job.template_name, category: job.category,
              variables: job.variables || {}, source: "scheduled",
            });
            if (r.ok) delivered++;
            else if (r.blocked === "quota_exceeded") blockedQuota++;
            else failed++;
          }
          await supabase.from("sms_scheduled_sends").update({
            status: "completed",
            executed_at: new Date().toISOString(),
            total_recipients: userIds.length,
            delivered_count: delivered,
            failed_count: failed,
            blocked_quota_count: blockedQuota,
          }).eq("id", job.id);
          executedIds.push(job.id);
        }
        return json({ executed: executedIds.length, ids: executedIds });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[sms-notify] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
