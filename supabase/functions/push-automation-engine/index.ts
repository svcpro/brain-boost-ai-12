import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, trigger_key, user_id, variables, title, body: notifBody, target_user_ids } = body;

    // Action: fire_trigger - Fires a specific trigger for a user
    if (action === "fire_trigger" && trigger_key && user_id) {
      return await fireTrigger(supabase, trigger_key, user_id, variables || {});
    }

    // Action: send_direct - Admin sends direct notification
    if (action === "send_direct" && title) {
      return await sendDirect(supabase, title, notifBody || "", target_user_ids, body.data || {});
    }

    // Action: process_queue - Process pending scheduled notifications
    if (action === "process_queue") {
      return await processQueue(supabase);
    }

    // Action: bulk_trigger - Fire trigger for multiple users
    if (action === "bulk_trigger" && trigger_key && target_user_ids?.length) {
      let sent = 0;
      for (const uid of target_user_ids) {
        const res = await fireTriggerInternal(supabase, trigger_key, uid, variables || {});
        if (res.sent) sent += res.sent;
      }
      return json({ sent });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("Push automation error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function fireTrigger(supabase: any, triggerKey: string, userId: string, variables: Record<string, any>) {
  const result = await fireTriggerInternal(supabase, triggerKey, userId, variables);
  return json(result);
}

async function fireTriggerInternal(supabase: any, triggerKey: string, userId: string, variables: Record<string, any>) {
  // Get trigger config
  const { data: trigger } = await supabase
    .from("push_notification_triggers")
    .select("*")
    .eq("trigger_key", triggerKey)
    .eq("is_enabled", true)
    .maybeSingle();

  if (!trigger) return { sent: 0, reason: "trigger_disabled_or_not_found" };

  // Check cooldown
  if (trigger.cooldown_minutes > 0) {
    const cooldownTime = new Date(Date.now() - trigger.cooldown_minutes * 60000).toISOString();
    const { data: recentLog } = await supabase
      .from("push_notification_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("trigger_key", triggerKey)
      .gte("created_at", cooldownTime)
      .limit(1)
      .maybeSingle();

    if (recentLog) return { sent: 0, reason: "cooldown_active" };
  }

  // Check user push preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("push_notification_prefs, display_name, exam_type")
    .eq("id", userId)
    .maybeSingle();

  const prefs = profile?.push_notification_prefs as Record<string, boolean> | null;
  const prefMap: Record<string, string> = {
    study_reminder: "studyReminders", inactive_hours: "studyReminders", inactive_days: "studyReminders",
    revision_reminder: "studyReminders", streak_milestone: "streakMilestones", streak_at_risk: "streakMilestones",
    streak_broken: "streakMilestones", memory_forget_risk: "brainUpdateReminders",
    brain_performance_improved: "brainUpdateReminders", brain_performance_declined: "brainUpdateReminders",
  };
  const prefKey = prefMap[triggerKey];
  if (prefKey && prefs && prefs[prefKey] === false) {
    return { sent: 0, reason: "user_opted_out" };
  }

  // Build notification content
  let title = "";
  let body = "";

  if (trigger.template_id) {
    const { data: template } = await supabase
      .from("push_notification_templates")
      .select("title_template, body_template")
      .eq("id", trigger.template_id)
      .maybeSingle();

    if (template) {
      title = resolveVariables(template.title_template, { ...variables, user_name: profile?.display_name || "Student" });
      body = resolveVariables(template.body_template, { ...variables, user_name: profile?.display_name || "Student" });
    }
  }

  // Use AI content generation if enabled and no template match
  if ((!title || trigger.use_ai_content) && Deno.env.get("LOVABLE_API_KEY")) {
    try {
      const aiContent = await generateAIContent(triggerKey, userId, variables, profile, supabase);
      if (aiContent) {
        title = aiContent.title;
        body = aiContent.body;
      }
    } catch (e) {
      console.error("AI content generation failed:", e);
    }
  }

  // Fallback
  if (!title) {
    title = trigger.display_name || "ACRY Brain";
    body = trigger.description || "You have a new update.";
  }

  // Schedule or send instantly
  if (trigger.schedule_type === "scheduled" && trigger.schedule_config?.delay_minutes) {
    const scheduledAt = new Date(Date.now() + trigger.schedule_config.delay_minutes * 60000).toISOString();
    await supabase.from("push_notification_queue").insert({
      user_id: userId, trigger_key: triggerKey, template_id: trigger.template_id,
      title, body, data: { trigger_key: triggerKey, ...variables },
      priority: trigger.priority, scheduled_at: scheduledAt,
    });
    return { sent: 0, queued: 1 };
  }

  // Send instantly
  const sent = await sendPushToUser(supabase, userId, title, body, { trigger_key: triggerKey, type: trigger.category, ...variables });

  // Log
  await supabase.from("push_notification_logs").insert({
    user_id: userId, trigger_key: triggerKey, template_id: trigger.template_id,
    title, body, data: { trigger_key: triggerKey, ...variables },
    status: sent > 0 ? "sent" : "no_devices", device_count: sent,
    ai_generated: trigger.use_ai_content,
  });

  // Update trigger stats
  await supabase.from("push_notification_triggers")
    .update({ total_sent: (trigger.total_sent || 0) + (sent > 0 ? 1 : 0) })
    .eq("id", trigger.id);

  return { sent };
}

async function sendDirect(supabase: any, title: string, body: string, targetUserIds?: string[], data?: any) {
  let userIds = targetUserIds || [];
  if (!userIds.length) {
    // Send to all users with push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .limit(10000);
    userIds = [...new Set(((subs || []) as any[]).map((s: any) => String(s.user_id)))];
  }

  let totalSent = 0;
  for (const uid of userIds) {
    const sent = await sendPushToUser(supabase, uid, title, body, data || {});
    totalSent += sent;
    await supabase.from("push_notification_logs").insert({
      user_id: uid, trigger_key: "admin_announcement", title, body,
      data: data || {}, status: sent > 0 ? "sent" : "no_devices", device_count: sent,
    });
  }
  return json({ sent: totalSent, users: userIds.length });
}

async function processQueue(supabase: any) {
  const now = new Date().toISOString();
  const { data: items } = await supabase
    .from("push_notification_queue")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("priority", { ascending: true })
    .limit(100);

  if (!items?.length) return json({ processed: 0 });

  let processed = 0;
  for (const item of items) {
    const sent = await sendPushToUser(supabase, item.user_id, item.title, item.body, item.data || {});
    await supabase.from("push_notification_queue")
      .update({ status: sent > 0 ? "sent" : "failed", sent_at: now })
      .eq("id", item.id);

    await supabase.from("push_notification_logs").insert({
      user_id: item.user_id, trigger_key: item.trigger_key, template_id: item.template_id,
      title: item.title, body: item.body, data: item.data,
      status: sent > 0 ? "sent" : "no_devices", device_count: sent,
    });
    processed++;
  }

  return json({ processed });
}

async function sendPushToUser(supabase: any, userId: string, title: string, body: string, data: any): Promise<number> {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return 0;

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 0;

  const payload = JSON.stringify({ title, body, data });
  let sent = 0;
  const expired: string[] = [];

  for (const sub of subs) {
    try {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, "mailto:noreply@acry.app"
      );
      if (result.success) sent++;
      if (result.expired) expired.push(sub.id);
    } catch (e) {
      console.error("Push send error:", e);
    }
  }

  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("id", expired);
  }

  return sent;
}

function resolveVariables(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

async function generateAIContent(triggerKey: string, userId: string, variables: Record<string, any>, profile: any, supabase: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const categoryPrompts: Record<string, string> = {
    memory_forget_risk: "Write an urgent but encouraging notification about memory decay risk.",
    weak_topic_detected: "Write a motivating notification about a newly detected weak topic.",
    memory_strength_improved: "Write a celebratory notification about memory improvement.",
    brain_performance_improved: "Write a celebration notification about brain performance gains.",
    brain_performance_declined: "Write a supportive notification about declining brain performance.",
    study_reminder: "Write a gentle, motivating study reminder.",
    inactive_hours: "Write a friendly nudge to get back to studying.",
    inactive_days: "Write a caring comeback notification for an inactive user.",
    streak_at_risk: "Write an urgent notification about streak being at risk.",
    streak_milestone: "Write an exciting celebration for a streak milestone.",
    fix_session_recommended: "Write a notification recommending a fix session for weak areas.",
    rank_improved: "Write an exciting notification about rank improvement.",
    rank_declined: "Write a supportive notification about rank decline with encouragement.",
  };

  const prompt = `You are ACRY Brain, an AI study assistant. Generate a push notification.
User: ${profile?.display_name || "Student"}, Exam: ${profile?.exam_type || "General"}
Trigger: ${triggerKey}
Context: ${JSON.stringify(variables)}
${categoryPrompts[triggerKey] || "Write a relevant, personalized notification."}
Return ONLY a JSON object with "title" (max 50 chars, with emoji) and "body" (max 150 chars, personal and actionable). No markdown.`;

  const { aiFetch } = await import("../_shared/aiFetch.ts");
  const response = await aiFetch({
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Web Push sender (same as send-push-notification)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string, vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string
) {
  const encoder = new TextEncoder();
  const header = { typ: "JWT", alg: "ES256" };
  const audience = new URL(subscription.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: audience, exp: now + 12 * 60 * 60, sub: vapidSubject };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const encodedClaims = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsignedToken = `${encodedHeader}.${encodedClaims}`;

  const privateKeyData = urlBase64ToUint8Array(vapidPrivateKey);
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8Key = new Uint8Array(pkcs8Header.length + privateKeyData.length);
  pkcs8Key.set(pkcs8Header);
  pkcs8Key.set(privateKeyData, pkcs8Header.length);

  const key = await crypto.subtle.importKey("pkcs8", pkcs8Key, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsignedToken));
  const sigArray = new Uint8Array(signature);
  const encodedSig = btoa(String.fromCharCode(...sigArray)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = `${unsignedToken}.${encodedSig}`;

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: { Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`, "Content-Type": "application/json", TTL: "86400" },
    body: payload,
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 410 || response.status === 404) return { expired: true };
    return { error: text };
  }
  await response.text();
  return { success: true };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
