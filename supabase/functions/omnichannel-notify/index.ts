import { createClient } from "npm:@supabase/supabase-js@2";
import { sanitizeMessage } from "../_shared/variableResolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIORITY_MAP: Record<string, string[]> = {
  critical: ["push", "email", "voice"],
  high: ["push", "email"],
  medium: ["push"],
  low: ["in_app"],
};

interface EventPayload {
  event_type: string;
  user_id?: string;
  user_ids?: string[];
  source?: string;
  data?: Record<string, any>;
  title?: string;
  body?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const payload: EventPayload = await req.json();
    const { event_type, source = "web", data = {} } = payload;

    if (!event_type) {
      return json({ error: "event_type required" }, 400);
    }

    // Resolve target users
    const userIds: string[] = payload.user_ids
      ? payload.user_ids
      : payload.user_id
      ? [payload.user_id]
      : [];

    if (userIds.length === 0) {
      return json({ error: "user_id or user_ids required" }, 400);
    }

    // Fetch rule for this event
    const { data: rule } = await supabase
      .from("omnichannel_rules")
      .select("*")
      .eq("event_type", event_type)
      .eq("is_enabled", true)
      .maybeSingle();

    if (!rule) {
      return json({ processed: 0, reason: "no_active_rule" });
    }

    // Cooldown check
    if (rule.cooldown_minutes > 0 && rule.last_triggered_at) {
      const cooldownEnd = new Date(
        new Date(rule.last_triggered_at).getTime() + rule.cooldown_minutes * 60000
      );
      if (new Date() < cooldownEnd) {
        return json({ processed: 0, reason: "cooldown_active" });
      }
    }

    let channels: string[] = rule.channels || PRIORITY_MAP[rule.priority] || ["push"];
    const fallbackChannels: string[] = rule.fallback_channels || [];
    let title = payload.title || data.title || rule.display_name;
    let body = payload.body || data.body || "";

    // ── UVR: Sanitize title & body before dispatch ──
    const titleSan = sanitizeMessage(title);
    const bodySan = sanitizeMessage(body);
    title = titleSan.cleaned || rule.display_name;
    body = bodySan.cleaned;
    if (titleSan.issues.length > 0 || bodySan.issues.length > 0) {
      console.warn(`[UVR] omnichannel title/body warnings for ${event_type}:`, [...titleSan.issues, ...bodySan.issues]);
    }

    let totalDelivered = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
      // ── BEHAVIORAL INTELLIGENCE LAYER ──

      // A. Dopamine Copy Generation
      if (rule.use_dopamine_copy && !payload.title) {
        try {
          const dcRes = await callEngine(SUPABASE_URL, SERVICE_KEY, {
            action: "generate_dopamine_copy", user_id: userId, event_type, data,
          });
          if (dcRes?.title) { title = dcRes.title; body = dcRes.body || body; }
        } catch { /* fallback to original */ }
      }

      // B. Smart Channel Selection (auto-learning)
      if (rule.use_smart_timing) {
        try {
          const scRes = await callEngine(SUPABASE_URL, SERVICE_KEY, {
            action: "get_smart_channels", user_id: userId,
          });
          if (scRes?.source === "learned" && scRes.channels?.length > 0) {
            // Merge learned priority with rule channels
            channels = scRes.channels.filter((c: string) => channels.includes(c) || rule.priority === "critical");
            if (channels.length === 0) channels = rule.channels || ["push"];
          }
        } catch { /* fallback */ }
      }

      // C. Escalation Check
      if (rule.escalation_enabled) {
        try {
          const escRes = await callEngine(SUPABASE_URL, SERVICE_KEY, {
            action: "check_escalation", user_id: userId, event_type,
          });
          if (escRes?.escalated && escRes.channels) {
            channels = escRes.channels;
          }
        } catch { /* fallback */ }
      }

      // D. Track engagement for send-time learning
      callEngine(SUPABASE_URL, SERVICE_KEY, {
        action: "track_engagement", user_id: userId, data: { type: "notification_received" },
      }).catch(() => {});

      // 1. Log the event
      const { data: eventRow } = await supabase
        .from("event_log")
        .insert({
          event_type,
          user_id: userId,
          source,
          priority: rule.priority,
          payload: data,
          status: "processing",
        })
        .select("id")
        .single();

      const eventId = eventRow?.id;

      // 2. Check user notification preferences
      const { data: profile } = await supabase
        .from("profiles")
        .select("push_notification_prefs, notification_preferences, phone, email")
        .eq("id", userId)
        .maybeSingle();

      // 3. Dispatch to each channel — inject original event_type for channel routing
      const dispatchData = { 
        ...data, 
        original_event_type: event_type,
        sms_template_name: rule.sms_template_name || null,
      };
      for (const channel of channels) {
        const deliveryResult = await dispatchToChannel(
          supabase,
          SUPABASE_URL,
          SERVICE_KEY,
          { channel, userId, title, body, data: dispatchData, eventId, priority: rule.priority, retries: rule.retry_count, profile }
        );

        // Log delivery
        await supabase.from("notification_delivery_log").insert({
          event_id: eventId,
          user_id: userId,
          channel,
          status: deliveryResult.success ? "delivered" : "failed",
          priority: rule.priority,
          title,
          body,
          retry_count: deliveryResult.retryCount || 0,
          max_retries: rule.retry_count,
          error_message: deliveryResult.error || null,
          delivered_at: deliveryResult.success ? new Date().toISOString() : null,
        });

        if (deliveryResult.success) {
          totalDelivered++;
          // Track channel effectiveness (non-blocking)
          callEngine(SUPABASE_URL, SERVICE_KEY, {
            action: "update_channel_effectiveness",
            user_id: userId,
            data: { channel, outcome: "sent" },
          }).catch(() => {});
        } else {
          totalFailed++;
          // Try fallback
          const fallback = fallbackChannels.find((f) => !channels.includes(f));
          if (fallback) {
            const fbResult = await dispatchToChannel(
              supabase,
              SUPABASE_URL,
              SERVICE_KEY,
              { channel: fallback, userId, title, body, data, eventId, priority: rule.priority, retries: rule.retry_count, profile }
            );
            await supabase.from("notification_delivery_log").insert({
              event_id: eventId,
              user_id: userId,
              channel: fallback,
              status: fbResult.success ? "delivered" : "failed",
              priority: rule.priority,
              title,
              body,
              retry_count: fbResult.retryCount || 0,
              fallback_channel: channel as any,
              error_message: fbResult.error || null,
              delivered_at: fbResult.success ? new Date().toISOString() : null,
            });
            if (fbResult.success) totalDelivered++;
          }
        }
      }

      // Mark event processed
      if (eventId) {
        await supabase
          .from("event_log")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("id", eventId);
      }
    }

    // Update rule stats
    await supabase
      .from("omnichannel_rules")
      .update({
        last_triggered_at: new Date().toISOString(),
        total_triggered: (rule.total_triggered || 0) + userIds.length,
        total_delivered: (rule.total_delivered || 0) + totalDelivered,
        total_failed: (rule.total_failed || 0) + totalFailed,
      })
      .eq("id", rule.id);

    return json({
      processed: userIds.length,
      delivered: totalDelivered,
      failed: totalFailed,
      event_type,
    });
  } catch (e) {
    console.error("omnichannel-notify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

// ─── Channel Dispatcher ───

interface DispatchParams {
  channel: string;
  userId: string;
  title: string;
  body: string;
  data: Record<string, any>;
  eventId?: string;
  priority: string;
  retries: number;
  profile?: any;
}

async function dispatchToChannel(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  params: DispatchParams
): Promise<{ success: boolean; retryCount?: number; error?: string }> {
  const { channel, userId, title, body, data, retries, profile } = params;

  let attempt = 0;
  while (attempt <= retries) {
    try {
      switch (channel) {
        case "push":
          return await sendPush(supabaseUrl, serviceKey, userId, title, body, data);
        case "email":
          return await sendEmail(supabaseUrl, serviceKey, userId, title, body, data);
        case "voice":
          return await sendVoice(supabaseUrl, serviceKey, userId, title, body, data);
        case "whatsapp":
          return await sendWhatsApp(supabaseUrl, serviceKey, userId, title, body, data);
        case "sms":
          return await sendSms(supabaseUrl, serviceKey, userId, title, body, data);
        case "in_app":
          // Store in-app notification directly
          await supabase.from("notifications").insert({
            user_id: userId,
            title,
            message: body,
            type: data.type || "system",
            action_url: data.action_url || null,
          });
          return { success: true, retryCount: attempt };
        default:
          return { success: false, error: `Unknown channel: ${channel}` };
      }
    } catch (err) {
      attempt++;
      if (attempt > retries) {
        return {
          success: false,
          retryCount: attempt,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt)); // exponential backoff
    }
  }
  return { success: false, retryCount: retries, error: "Max retries exceeded" };
}

// ─── Channel Senders ───

async function sendPush(
  url: string, key: string, userId: string, title: string, body: string, data: Record<string, any>
) {
  const res = await fetch(`${url}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: userId, title, body, data }),
  });
  const result = await res.json();
  return { success: (result.sent || 0) > 0, retryCount: 0, error: result.error };
}

async function sendEmail(
  url: string, key: string, userId: string, title: string, body: string, data: Record<string, any>
) {
  const res = await fetch(`${url}/functions/v1/trigger-email`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ trigger_key: data.event_type || "general", user_id: userId, variables: { title, body, ...data } }),
  });
  const result = await res.json();
  return { success: !result.error, retryCount: 0, error: result.error };
}

async function sendVoice(
  url: string, key: string, userId: string, title: string, body: string, data: Record<string, any>
) {
  const voiceText = `${title}. ${body}`.trim();
  const res = await fetch(`${url}/functions/v1/voice-automation-engine`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "send_direct", user_id: userId, voice_text: voiceText, title, body, data }),
  });
  const result = await res.json();
  return { success: result.success || (result.queued || 0) > 0, retryCount: 0, error: result.error };
}

async function sendWhatsApp(
  url: string, key: string, userId: string, title: string, body: string, data: Record<string, any>
) {
  const templateName = data.whatsapp_template || data.template_name || "acry_daily_mission";
  const category = data.category || (data.priority === "critical" ? "critical" : "engagement");
  const variables = data.whatsapp_variables || data.variables || { name: title };
  const res = await fetch(`${url}/functions/v1/whatsapp-notify?action=send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, template_name: templateName, category, variables, source: "omnichannel" }),
  });
  const result = await res.json();
  return { success: !!result.ok, retryCount: 0, error: result.error || result.blocked };
}

async function sendSms(
  url: string, key: string, userId: string, title: string, body: string, data: Record<string, any>
) {
  // Resolve SMS template name from rule mapping or explicit override in data
  const templateName = data.sms_template || data.sms_template_name || null;
  if (!templateName) {
    return { success: false, retryCount: 0, error: "no_sms_template_for_event" };
  }
  // Build template variables: prefer explicit sms_variables, else fall back to data + title/body
  const variables = data.sms_variables || {
    name: data.name || title,
    title,
    body,
    ...data,
  };
  const category = data.sms_category 
    || (data.original_event_type?.startsWith("auth_") || data.priority === "critical" ? "critical" : "engagement");
  const res = await fetch(`${url}/functions/v1/sms-notify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({
      action: "send",
      user_id: userId,
      template_name: templateName,
      variables,
      category,
      priority: data.priority || "medium",
      source: "omnichannel",
    }),
  });
  const result = await res.json().catch(() => ({}));
  return { success: !!result.ok, retryCount: 0, error: result.error || result.reason };
}


async function callEngine(url: string, key: string, body: Record<string, any>) {
  const res = await fetch(`${url}/functions/v1/intelligent-notify-engine`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? await res.json() : null;
}

// ─── Helpers ───

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
