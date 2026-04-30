// OneSignal Dispatch — central send pipeline.
// Actions: send_event | send_broadcast | send_to_user | get_app_config
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SendOptions {
  user_ids?: string[];
  player_ids?: string[];
  segments?: string[];
  title: string;
  body: string;
  icon_url?: string;
  image_url?: string;
  deep_link?: string;
  data?: Record<string, unknown>;
}

async function pushToOneSignal(opts: SendOptions): Promise<{ id?: string; error?: string; raw?: unknown }> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return { error: "OneSignal not configured" };
  }
  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: opts.title },
    contents: { en: opts.body },
    chrome_web_icon: opts.icon_url,
    chrome_web_image: opts.image_url,
    web_url: opts.deep_link,
    url: opts.deep_link,
    data: opts.data || {},
  };
  if (opts.player_ids?.length) payload.include_player_ids = opts.player_ids;
  else if (opts.user_ids?.length) payload.include_external_user_ids = opts.user_ids;
  else if (opts.segments?.length) payload.included_segments = opts.segments;
  else payload.included_segments = ["Subscribed Users"];

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const txt = await res.text();
    let parsed: any = {};
    try { parsed = JSON.parse(txt); } catch { /* keep raw */ }
    if (!res.ok) return { error: parsed?.errors?.join?.(", ") || txt, raw: parsed };
    return { id: parsed.id, raw: parsed };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkUserAllowed(userId: string, eventKey?: string, category?: string): Promise<{ ok: boolean; reason?: string }> {
  const [{ data: prefs }, { data: rule }, { data: cat }] = await Promise.all([
    supabase.from("push_user_prefs").select("*").eq("user_id", userId).maybeSingle(),
    eventKey ? supabase.from("push_automation_rules").select("*").eq("event_key", eventKey).maybeSingle() : Promise.resolve({ data: null }),
    eventKey && !category ? supabase.from("push_event_catalog").select("category").eq("event_key", eventKey).maybeSingle() : Promise.resolve({ data: null }),
  ]) as any;

  if (rule && rule.enabled === false) return { ok: false, reason: "rule_disabled" };

  const cKey = category || cat?.category;
  if (prefs) {
    if (prefs.master_enabled === false) return { ok: false, reason: "master_off" };
    const map: Record<string, string> = { study: "category_study", exam: "category_exam", growth: "category_growth", social: "category_social", system: "category_system" };
    const f = map[cKey || ""];
    if (f && (prefs as any)[f] === false) return { ok: false, reason: "category_off" };
    // Quiet hours
    if (prefs.quiet_hours_enabled && rule?.respect_quiet_hours !== false) {
      try {
        const now = new Date();
        const tzNow = new Date(now.toLocaleString("en-US", { timeZone: prefs.timezone || "Asia/Kolkata" }));
        const mins = tzNow.getHours() * 60 + tzNow.getMinutes();
        const [sh, sm] = String(prefs.quiet_start || "22:00").split(":").map(Number);
        const [eh, em] = String(prefs.quiet_end || "07:00").split(":").map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        const inQuiet = start < end ? (mins >= start && mins < end) : (mins >= start || mins < end);
        if (inQuiet) return { ok: false, reason: "quiet_hours" };
      } catch { /* ignore */ }
    }
  }

  // Throttle
  if (rule?.throttle_per_user_per_day) {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from("push_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since)
      .in("status", ["sent", "delivered", "clicked"]);
    if ((count ?? 0) >= rule.throttle_per_user_per_day) return { ok: false, reason: "throttled" };
  }

  return { ok: true };
}

async function pickTemplate(eventKey: string, vars: Record<string, unknown>) {
  const { data: tmpls } = await supabase
    .from("push_templates")
    .select("*")
    .eq("event_key", eventKey)
    .eq("is_active", true);
  if (!tmpls?.length) return null;
  // Weighted random across variants
  const total = tmpls.reduce((s: number, t: any) => s + (t.weight || 50), 0);
  let r = Math.random() * total;
  let chosen: any = tmpls[0];
  for (const t of tmpls) {
    r -= (t.weight || 50);
    if (r <= 0) { chosen = t; break; }
  }
  const interp = (s: string) => String(s || "").replace(/\{\{(\w+)\}\}/g, (_m, k) => String((vars as any)[k] ?? ""));
  return {
    ...chosen,
    title: interp(chosen.title),
    body: interp(chosen.body),
    deep_link: interp(chosen.deep_link || ""),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "send_event";

    if (action === "get_app_config") {
      return json({ app_id: ONESIGNAL_APP_ID, configured: !!ONESIGNAL_APP_ID });
    }

    if (action === "send_event") {
      const { event_key, user_id, user_ids, data = {}, title: tOver, body: bOver } = body;
      if (!event_key) return json({ error: "event_key required" }, 400);
      const targets: string[] = user_ids?.length ? user_ids : (user_id ? [user_id] : []);
      if (!targets.length) return json({ error: "user_id(s) required" }, 400);

      const { data: cat } = await supabase.from("push_event_catalog").select("category, priority").eq("event_key", event_key).maybeSingle();
      const tmpl = await pickTemplate(event_key, data);
      const title = tOver || tmpl?.title || event_key;
      const bodyTxt = bOver || tmpl?.body || "";

      const results: any[] = [];
      for (const uid of targets) {
        const allowed = await checkUserAllowed(uid, event_key, cat?.category);
        if (!allowed.ok) {
          await supabase.from("push_deliveries").insert({
            user_id: uid, event_key, title, body: bodyTxt,
            status: "suppressed", suppression_reason: allowed.reason, payload: { data },
          });
          results.push({ user_id: uid, suppressed: allowed.reason });
          continue;
        }
        const send = await pushToOneSignal({
          user_ids: [uid],
          title, body: bodyTxt,
          icon_url: tmpl?.icon_url, image_url: tmpl?.image_url,
          deep_link: tmpl?.deep_link, data: { ...(tmpl?.data || {}), ...data, event_key },
        });
        await supabase.from("push_deliveries").insert({
          user_id: uid, event_key, template_id: tmpl?.id, variant: tmpl?.variant,
          title, body: bodyTxt,
          onesignal_notification_id: send.id,
          status: send.error ? "failed" : "sent",
          error: send.error,
          sent_at: send.error ? null : new Date().toISOString(),
          payload: { data },
        });
        results.push({ user_id: uid, ok: !send.error, id: send.id, error: send.error });
      }
      return json({ ok: true, results });
    }

    if (action === "send_broadcast") {
      const { campaign_id, title, body: txt, segments = ["Subscribed Users"], filters, image_url, icon_url, deep_link, data = {} } = body;
      if (!title || !txt) return json({ error: "title and body required" }, 400);
      const send = await pushToOneSignal({ segments, title, body: txt, image_url, icon_url, deep_link, data });
      if (campaign_id) {
        await supabase.from("push_campaigns").update({
          status: send.error ? "failed" : "sent",
          sent_at: new Date().toISOString(),
          onesignal_notification_id: send.id,
          stats: send.raw || {},
        }).eq("id", campaign_id);
      }
      await supabase.from("push_deliveries").insert({
        campaign_id, title, body: txt,
        onesignal_notification_id: send.id,
        status: send.error ? "failed" : "sent",
        error: send.error,
        sent_at: send.error ? null : new Date().toISOString(),
        payload: { segments, filters, data },
      });
      return json({ ok: !send.error, id: send.id, error: send.error });
    }

    if (action === "send_to_user") {
      const { user_id, title, body: txt, data = {}, deep_link } = body;
      if (!user_id || !title || !txt) return json({ error: "user_id, title, body required" }, 400);
      const send = await pushToOneSignal({ user_ids: [user_id], title, body: txt, deep_link, data });
      await supabase.from("push_deliveries").insert({
        user_id, title, body: txt,
        onesignal_notification_id: send.id,
        status: send.error ? "failed" : "sent",
        error: send.error,
        sent_at: send.error ? null : new Date().toISOString(),
      });
      return json({ ok: !send.error, id: send.id, error: send.error });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("onesignal-dispatch:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
