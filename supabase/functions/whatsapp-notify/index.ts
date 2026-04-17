// ═══════════════════════════════════════════════════════════
// WhatsApp Notify Edge Function (MSG91)
// Actions: send | bulk-send | run-rule | check-quota | execute-scheduled
// Quota policy: 40/month per user (configurable). Hard cap with auto
// fallback to Push + Email when exceeded.
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

function normalizeIndianMobile(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const cleaned = digits.startsWith("00") ? digits.slice(2) : digits;
  if (/^\d{10}$/.test(cleaned)) return `91${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `91${cleaned.slice(1)}`;
  if (/^91\d{10}$/.test(cleaned)) return cleaned;
  return null;
}

function applyTemplate(body: string, vars: Record<string, unknown>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars[k] ?? ""));
}

interface Config {
  is_enabled: boolean;
  monthly_limit_per_user: number;
  allowed_categories: string[];
  fallback_channels: string[];
  integrated_number: string;
  default_namespace: string;
  auto_fallback_on_quota_exceeded: boolean;
}

async function loadConfig(supabase: any): Promise<Config> {
  const { data } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
  return data ?? {
    is_enabled: true,
    monthly_limit_per_user: 40,
    allowed_categories: ["critical", "engagement"],
    fallback_channels: ["push", "email"],
    integrated_number: "918796032562",
    default_namespace: "5a93dcbd_6802_42d5_af95_17d4fd2d7441",
    auto_fallback_on_quota_exceeded: true,
  };
}

async function sendViaMSG91(opts: {
  authKey: string;
  config: Config;
  templateName: string;
  namespace?: string;
  language?: string;
  mobile: string;
  variables: Record<string, string>;
  buttons?: Array<{ type: string; text?: string; url?: string; phone_number?: string }>;
}): Promise<{ ok: boolean; raw: any; messageId?: string; error?: string }> {
  const { authKey, config, templateName, namespace, language, mobile, variables, buttons } = opts;
  const components = Object.values(variables).map((v) => ({ type: "text", value: String(v) }));

  // Build component map: body_1 + button_1, button_2... for URL buttons that carry a dynamic URL suffix
  const componentMap: Record<string, any> = {};
  if (components.length > 0) {
    componentMap.body_1 = { type: "text", value: components.map((c) => c.value).join(" ") };
  }
  if (Array.isArray(buttons)) {
    buttons.forEach((b, idx) => {
      // Only URL buttons can carry runtime params; text/phone are baked into the approved template
      if (b.type === "URL" && b.url) {
        // MSG91 expects button index starting at 1; provide URL suffix variable if template uses {{1}} in URL
        componentMap[`button_${idx + 1}`] = {
          subtype: "url",
          parameters: [{ type: "text", text: variables[`btn_${idx + 1}`] || "" }],
        };
      }
    });
  }

  const payload = {
    integrated_number: config.integrated_number,
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: {
        name: templateName,
        language: { code: language || "en", policy: "deterministic" },
        namespace: namespace || config.default_namespace,
        to_and_components: [{
          to: [mobile],
          components: componentMap,
        }],
      },
    },
  };

  try {
    const resp = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", authkey: authKey },
        body: JSON.stringify(payload),
      },
    );
    const text = await resp.text();
    let raw: any;
    try { raw = JSON.parse(text); } catch { raw = { type: resp.ok ? "success" : "error", message: text.slice(0, 300) }; }
    const messageId = raw?.data?.[0]?.message_id || raw?.message_id;
    return { ok: resp.ok && raw?.type !== "error", raw, messageId };
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
          body: JSON.stringify({ recipient_id: userId, title, body, data: { source: "whatsapp_fallback" } }),
        });
      } else if (ch === "email") {
        await fetch(`${url}/functions/v1/trigger-email`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger_key: "general", user_id: userId, variables: { title, body } }),
        });
      }
    } catch (e) {
      console.error(`[wa-notify] fallback ${ch} failed:`, e);
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
    templateName: string;
    category: string;
    variables: Record<string, string>;
    source: string;
    triggeredBy?: string;
    ruleId?: string;
  },
) {
  const { userId, templateName, category, variables, source, triggeredBy, ruleId } = args;

  // Resolve phone + opt-in from profile if user_id provided
  let phone = args.phone;
  let optedIn = true;
  let allowedCats: string[] = config.allowed_categories;

  if (userId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("phone, whatsapp_enabled, whatsapp_categories")
      .eq("id", userId)
      .maybeSingle();
    if (prof) {
      phone = phone || prof.phone || undefined;
      optedIn = prof.whatsapp_enabled !== false;
      allowedCats = prof.whatsapp_categories?.length ? prof.whatsapp_categories : config.allowed_categories;
    }
  }

  const mobile = normalizeIndianMobile(phone);
  if (!mobile) {
    return { ok: false, blocked: "no_phone" };
  }

  // Category gate
  if (!config.allowed_categories.includes(category) || !allowedCats.includes(category)) {
    return { ok: false, blocked: "category_not_allowed" };
  }

  if (!optedIn) {
    return { ok: false, blocked: "opted_out" };
  }

  // Quota check (only enforced for known users)
  let quotaExceeded = false;
  if (userId) {
    const { data: rem } = await supabase.rpc("whatsapp_quota_remaining", { p_user_id: userId });
    if ((rem ?? 0) <= 0) quotaExceeded = true;
  }

  // Load template
  const { data: tpl } = await supabase
    .from("whatsapp_templates")
    .select("name, body_template, category, variables")
    .eq("name", templateName)
    .eq("is_active", true)
    .maybeSingle();

  // Load Meta-approved template metadata (buttons, language, namespace) for richer payload
  const { data: metaTpl } = await supabase
    .from("whatsapp_meta_templates")
    .select("buttons, language")
    .eq("template_name", templateName)
    .maybeSingle();
  const metaButtons = (metaTpl?.buttons as any) || [];
  const metaLanguage = (metaTpl?.language as any) || undefined;

  const bodyText = tpl?.body_template ? applyTemplate(tpl.body_template, variables) : `${templateName}`;
  const titleText = tpl?.name || templateName;

  // Quota exceeded → log + fallback
  if (quotaExceeded) {
    await supabase.from("whatsapp_messages").insert({
      user_id: userId,
      to_number: mobile,
      message_type: "template",
      content: bodyText,
      template_name: templateName,
      template_params: variables,
      status: "blocked_quota",
      error_message: "monthly_limit_reached",
      direction: "outbound",
      category,
    });

    if (config.auto_fallback_on_quota_exceeded && userId) {
      await sendFallback(supabase, url, key, config.fallback_channels, userId, titleText, bodyText);
    }
    return { ok: false, blocked: "quota_exceeded", fallbackSent: config.auto_fallback_on_quota_exceeded };
  }

  // Send via MSG91
  const result = await sendViaMSG91({
    authKey,
    config,
    templateName,
    mobile,
    variables,
  });

  // Log
  await supabase.from("whatsapp_messages").insert({
    user_id: userId,
    to_number: mobile,
    message_type: "template",
    content: bodyText,
    template_name: templateName,
    template_params: variables,
    status: result.ok ? "sent" : "failed",
    error_message: result.ok ? null : (result.error || JSON.stringify(result.raw).slice(0, 500)),
    direction: "outbound",
    category,
    twilio_sid: result.messageId || null,
  });

  if (result.ok && userId) {
    await supabase.rpc("whatsapp_quota_increment", { p_user_id: userId });
  }

  return { ok: result.ok, messageId: result.messageId, error: result.error };
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

    if (!config.is_enabled) {
      return json({ error: "WhatsApp notifications globally disabled" }, 403);
    }

    const reqUrl = new URL(req.url);
    const action = reqUrl.searchParams.get("action") || (await req.clone().json().catch(() => ({}))).action || "send";
    const body = await req.json().catch(() => ({}));

    switch (action) {
      case "check-quota": {
        const userId = body.user_id;
        if (!userId) return json({ error: "user_id required" }, 400);
        const { data: rem } = await supabase.rpc("whatsapp_quota_remaining", { p_user_id: userId });
        const { data: q } = await supabase.from("whatsapp_quota").select("*").eq("user_id", userId).maybeSingle();
        return json({
          remaining: rem ?? config.monthly_limit_per_user,
          used: q?.count ?? 0,
          limit: config.monthly_limit_per_user,
          reset_at: q?.reset_at,
        });
      }

      case "send": {
        const { user_id, phone, template_name, category = "engagement", variables = {}, source = "manual", triggered_by } = body;
        if (!template_name) return json({ error: "template_name required" }, 400);
        if (!user_id && !phone) return json({ error: "user_id or phone required" }, 400);
        const result = await processOneRecipient(supabase, url, key, authKey, config, {
          userId: user_id, phone, templateName: template_name, category, variables, source, triggeredBy: triggered_by,
        });
        return json(result);
      }

      case "bulk-send": {
        const { user_ids = [], template_name, category = "engagement", variables = {}, source = "bulk", triggered_by } = body;
        if (!template_name) return json({ error: "template_name required" }, 400);
        if (!Array.isArray(user_ids) || user_ids.length === 0) return json({ error: "user_ids required" }, 400);

        let delivered = 0, failed = 0, blockedQuota = 0, blockedOptOut = 0, fallbackSent = 0;
        for (const uid of user_ids) {
          const r = await processOneRecipient(supabase, url, key, authKey, config, {
            userId: uid, templateName: template_name, category, variables, source, triggeredBy: triggered_by,
          });
          if (r.ok) delivered++;
          else if (r.blocked === "quota_exceeded") {
            blockedQuota++;
            if (r.fallbackSent) fallbackSent++;
          } else if (r.blocked === "opted_out") blockedOptOut++;
          else failed++;
        }
        return json({ total: user_ids.length, delivered, failed, blocked_quota: blockedQuota, blocked_opt_out: blockedOptOut, fallback_sent: fallbackSent });
      }

      case "execute-scheduled": {
        // Find any due scheduled jobs and execute
        const { data: due } = await supabase
          .from("whatsapp_scheduled_sends")
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
            const { data: users } = await supabase.from("profiles").select("id").eq("whatsapp_enabled", true).limit(2000);
            userIds = (users || []).map((u: any) => u.id);
          }
          let delivered = 0, failed = 0, blockedQuota = 0;
          for (const uid of userIds) {
            const r = await processOneRecipient(supabase, url, key, authKey, config, {
              userId: uid, templateName: job.template_name, category: job.category, variables: job.variables || {}, source: "scheduled",
            });
            if (r.ok) delivered++;
            else if (r.blocked === "quota_exceeded") blockedQuota++;
            else failed++;
          }
          await supabase
            .from("whatsapp_scheduled_sends")
            .update({
              status: "completed",
              executed_at: new Date().toISOString(),
              total_recipients: userIds.length,
              delivered_count: delivered,
              failed_count: failed,
              blocked_quota_count: blockedQuota,
            })
            .eq("id", job.id);
          executedIds.push(job.id);
        }
        return json({ executed: executedIds.length, ids: executedIds });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[whatsapp-notify] error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
