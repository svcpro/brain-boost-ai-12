// SMS Event Engine — automatic event-driven SMS dispatcher
// Receives an event_type + user_id + data, looks up registry, applies smart-default
// policy (critical bypass, engagement throttling, dedupe), then invokes sms-notify.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEDUPE_WINDOW_MS = 60 * 1000; // 1 minute
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function istTimeHHMM(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

function hasValue(value: unknown): boolean {
  return value != null && value !== "";
}

function isGenericAcryUrl(value: unknown): boolean {
  if (!hasValue(value)) return true;
  try {
    const u = new URL(String(value));
    const host = u.hostname.replace(/^www\./, "");
    return host === "acry.ai" && (u.pathname === "" || u.pathname === "/") && !u.search && !u.hash;
  } catch {
    return false;
  }
}

function addSemanticVariableAliases(vars: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(vars || {}) };
  const first = (keys: string[]) => keys.map((k) => out[k]).find(hasValue);

  const link = first(["link", "url", "target_url"]);
  if (hasValue(link)) {
    out.link ??= link;
    out.url ??= link;
    out.target_url ??= link;
  }

  const days = first(["days", "day_count", "dayCount", "day"]);
  if (hasValue(days)) {
    out.days ??= days;
    out.day_count ??= days;
    out.dayCount ??= days;
    out.daycount ??= days;
    out.day ??= days;
  }

  const time = first(["time", "scheduled_time", "send_time", "start_time", "sendTime", "startTime"]);
  if (hasValue(time)) {
    out.time ??= time;
    out.scheduled_time ??= time;
    out.send_time ??= time;
    out.start_time ??= time;
    out.sendTime ??= time;
    out.startTime ??= time;
  }

  return out;
}

type EventInput = {
  event_type: string;
  user_id?: string;
  user_ids?: string[];
  data?: Record<string, unknown>;
  override_mobile?: string;
  source?: string;
};

async function audit(
  user_id: string | null,
  event_key: string,
  outcome: string,
  reason: string,
  payload: Record<string, unknown> = {},
) {
  try {
    await sb.from("sms_event_audit").insert({ user_id, event_key, outcome, reason, payload });
  } catch (_) {
    // non-blocking
  }
}

function mapVariables(
  data: Record<string, unknown>,
  variableMap: Record<string, string>,
  userName: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [slot, key] of Object.entries(variableMap || {})) {
    if (key === "name") {
      out[slot] = data.name ?? userName ?? "User";
    } else if (key === "app") {
      out[slot] = data.app ?? "ACRY";
    } else if (key === "link") {
      out[slot] = data.link ?? data.url ?? "https://acry.ai";
    } else if (key === "url") {
      out[slot] = data.url ?? data.link ?? "https://acry.ai";
    } else if (["days", "day_count", "daycount", "day"].includes(key)) {
      out[slot] = data.days ?? data.day_count ?? data.dayCount ?? data.daycount ?? data.day ?? 1;
    } else if (key === "time") {
      out[slot] = data.time ?? data.scheduled_time ?? data.send_time ?? data.start_time ?? data.sendTime ?? data.startTime ?? istTimeHHMM();
    } else {
      out[slot] = (data as any)[key] ?? "";
    }
  }
  // Always pass through link/url too so sms-notify auto-mapping works.
  if (data.link) out.link = data.link;
  if (data.url) out.url = data.url;
  if (data.name && !out.var1) out.var1 = data.name;
  return addSemanticVariableAliases(out);
}

function fallbackValueForPlaceholder(key: string, vars: Record<string, unknown>, userName: string): unknown {
  const lower = key.toLowerCase();
  const aliases: Record<string, string[]> = {
    url: ["url", "link", "target_url"],
    link: ["link", "url", "target_url"],
    target_url: ["target_url", "url", "link"],
    name: ["name", "display_name", "user_name"],
    otp: ["otp", "code"],
    code: ["code", "otp"],
    days: ["days", "day_count", "dayCount", "day"],
    day_count: ["day_count", "days", "dayCount", "day"],
    daycount: ["dayCount", "day_count", "days", "day"],
    day: ["day", "days", "day_count", "dayCount"],
    time: ["time", "scheduled_time", "send_time", "start_time"],
    scheduled_time: ["scheduled_time", "time", "send_time", "start_time"],
    sendtime: ["sendTime", "send_time", "time", "scheduled_time"],
    starttime: ["startTime", "start_time", "time", "scheduled_time"],
  };
  for (const alias of aliases[lower] || [key, lower]) {
    const value = vars[alias];
    if (value != null && value !== "") return value;
  }
  const defaults: Record<string, unknown> = {
    name: userName || "User",
    link: "https://acry.ai",
    url: "https://acry.ai",
    target_url: "https://acry.ai",
    app: "ACRY",
    exam: "your exam",
    topic: "today's focus topic",
    days: 1,
    day: 1,
    day_count: 1,
    daycount: 1,
    hours: 2,
    time: istTimeHHMM(),
    scheduled_time: istTimeHHMM(),
    send_time: istTimeHHMM(),
    sendtime: istTimeHHMM(),
    starttime: istTimeHHMM(),
    device: "your device",
    stability: 80,
    strength: 50,
    rank: 100,
    positions: 1,
    points: 10,
    questions: 25,
    accuracy: 75,
    friend: "a friend",
    count: 5,
    prob: 70,
    amount: 149,
    expiry: "your renewal date",
    milestone: "a new milestone",
    reward: "a reward",
  };
  return defaults[lower] ?? "ACRY";
}

async function processOne(input: { event_type: string; user_id: string; data: Record<string, unknown>; override_mobile?: string; source?: string; bypass_quota?: boolean }) {
  const { event_type, user_id, data, override_mobile, source, bypass_quota } = input;

  // 1. Lookup event registry
  const { data: ev, error: evErr } = await sb
    .from("sms_event_registry")
    .select("*")
    .eq("event_key", event_type)
    .maybeSingle();

  if (evErr || !ev) {
    await audit(user_id, event_type, "skipped", "event_not_in_registry");
    return { ok: false, status: "event_not_in_registry" };
  }

  if (!ev.is_enabled) {
    await audit(user_id, event_type, "skipped", "event_disabled");
    return { ok: false, status: "event_disabled" };
  }

  if (!ev.template_name) {
    await audit(user_id, event_type, "skipped", "no_template_mapped");
    return { ok: false, status: "no_template_mapped" };
  }

  const isCritical = bypass_quota === true || ev.bypass_quota === true || ["critical", "otp", "security", "payment"].includes(ev.category);

  // 2. Dedupe + daily cap (skip for critical)
  if (!isCritical) {
    const { data: dd } = await sb
      .from("sms_event_dedupe")
      .select("*")
      .eq("user_id", user_id)
      .eq("event_key", event_type)
      .maybeSingle();

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    if (dd) {
      const last = new Date(dd.last_fired_at).getTime();
      if (now - last < DEDUPE_WINDOW_MS) {
        await audit(user_id, event_type, "skipped", "dedupe_window");
        return { ok: false, status: "dedupe_window" };
      }
      if (dd.day_key === today && dd.daily_count >= (ev.daily_cap_per_user ?? 1)) {
        await audit(user_id, event_type, "skipped", "daily_cap_reached");
        return { ok: false, status: "daily_cap_reached" };
      }
    }
  }

  // 3. Resolve user mobile + name
  let mobile = override_mobile || null;
  let userName = "User";
  if (!mobile) {
    const { data: prof } = await sb
      .from("profiles")
      .select("phone, display_name")
      .eq("id", user_id)
      .maybeSingle();
    mobile = prof?.phone || null;
    userName = prof?.display_name || "User";
  }

  if (!mobile) {
    await audit(user_id, event_type, "skipped", "no_mobile");
    return { ok: false, status: "no_mobile" };
  }

  // 4. Map variables (raw, based on event registry's variable_map)
  let rawVariables = mapVariables(data || {}, (ev.variable_map as any) || {}, userName);

  // 4b. Auto-align to the template's registered variable list.
  // MSG91 / DLT will silently reject (or fail to deliver) when extra variables
  // are sent or when names don't match the template's registered slots.
  const { data: tpl } = await sb
    .from("sms_templates")
    .select("name, variables, dlt_template_id, body_template, target_url")
    .eq("name", ev.template_name)
    .maybeSingle();

  let alignedVariables: Record<string, unknown> = rawVariables;
  let alignmentNote: string | null = null;

  // Source of truth: extract actual placeholders from the template body
  // (##key## DLT-style and {{key}} mustache-style). MSG91/DLT silently drop
  // messages when placeholders aren't substituted, so we MUST send keys that
  // exist in the body — not just the registered `variables` array.
  const bodyPlaceholders: string[] = [];
  if (tpl?.body_template) {
    const seen = new Set<string>();
    const re = /##([a-zA-Z0-9_]+)##|\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(tpl.body_template as string)) !== null) {
      const key = m[1] || m[2];
      if (key && !seen.has(key)) {
        seen.add(key);
        bodyPlaceholders.push(key);
      }
    }
  }

  // Prefer body placeholders; fall back to declared variables list.
  const expectedSlots: string[] =
    bodyPlaceholders.length > 0
      ? bodyPlaceholders
      : Array.isArray(tpl?.variables)
        ? (tpl!.variables as string[])
        : [];

  if (tpl?.target_url) {
    for (const key of ["link", "url", "target_url"]) {
      if (!hasValue(rawVariables[key]) || isGenericAcryUrl(rawVariables[key])) rawVariables[key] = tpl.target_url;
    }
    rawVariables = addSemanticVariableAliases(rawVariables);
  }

  if (expectedSlots.length > 0) {
    const aligned: Record<string, unknown> = {};
    // Known semantic slot names — never use positional fallback for these,
    // always go straight to the typed default. Prevents "stability = Test User".
    const SEMANTIC_SLOTS = new Set([
      "name", "link", "url", "target_url", "otp", "code", "time", "scheduled_time", "send_time", "start_time", "app",
      "stability", "strength", "rank", "positions", "points",
      "questions", "accuracy", "prob", "amount", "count",
      "days", "day", "day_count", "daycount", "hours", "exam", "topic", "device", "friend",
      "expiry", "milestone", "reward",
    ]);
    const rawEntries = Object.entries(rawVariables);
    // Exclude special keys AND the var1/varN positional aliases AND empty strings
    // from the positional pool — otherwise `name` leaks into numeric slots.
    const allValues = rawEntries.filter(
      ([k, v]) =>
        !["name", "link", "url", "target_url", "days", "day", "day_count", "dayCount", "time", "scheduled_time", "send_time", "start_time"].includes(k) &&
        !/^var\d+$/i.test(k) &&
        v !== "" && v != null,
    );
    expectedSlots.forEach((slot, i) => {
      // 1) exact key match (non-empty)
      if (rawVariables[slot] !== undefined && rawVariables[slot] !== "" && rawVariables[slot] !== null) {
        aligned[slot] = rawVariables[slot];
        return;
      }
      // 2) common alias (link <-> url)
      if (slot === "url" && rawVariables.link) {
        aligned[slot] = rawVariables.link;
        return;
      }
      if (slot === "link" && rawVariables.url) {
        aligned[slot] = rawVariables.url;
        return;
      }
      if (["days", "day_count", "day"].includes(slot) && [rawVariables.days, rawVariables.day_count, rawVariables.dayCount, rawVariables.day].some(hasValue)) {
        aligned[slot] = rawVariables.days ?? rawVariables.day_count ?? rawVariables.dayCount ?? rawVariables.day;
        return;
      }
      if (["time", "scheduled_time", "send_time", "start_time"].includes(slot) && [rawVariables.time, rawVariables.scheduled_time, rawVariables.send_time, rawVariables.start_time].some(hasValue)) {
        aligned[slot] = rawVariables.time ?? rawVariables.scheduled_time ?? rawVariables.send_time ?? rawVariables.start_time;
        return;
      }
      // 3) For known semantic slots, skip positional guessing and use typed default.
      if (SEMANTIC_SLOTS.has(slot.toLowerCase())) {
        aligned[slot] = fallbackValueForPlaceholder(slot, { ...data, ...rawVariables }, userName);
        return;
      }
      // 4) Positional fallback for unknown custom slots only
      const positional = allValues[i]?.[1];
      aligned[slot] = positional ?? fallbackValueForPlaceholder(slot, { ...data, ...rawVariables }, userName);
    });
    // pass-through helpers used by sms-notify auto-mapping
    if (hasValue(rawVariables.name) && !hasValue(aligned.name)) aligned.name = rawVariables.name;
    if (hasValue(rawVariables.link) && !hasValue(aligned.link)) aligned.link = rawVariables.link;
    if (hasValue(rawVariables.url) && !hasValue(aligned.url)) aligned.url = rawVariables.url;
    if (hasValue(rawVariables.days) && !hasValue(aligned.days)) aligned.days = rawVariables.days;
    if (hasValue(rawVariables.day_count) && !hasValue(aligned.day_count)) aligned.day_count = rawVariables.day_count;
    if (hasValue(rawVariables.time) && !hasValue(aligned.time)) aligned.time = rawVariables.time;

    alignedVariables = addSemanticVariableAliases(aligned);
    alignmentNote =
      bodyPlaceholders.length > 0
        ? `aligned_to_body_placeholders:${bodyPlaceholders.join(",")}`
        : `aligned_to_template_vars:${expectedSlots.join(",")}`;
  } else if (tpl) {
    alignmentNote = "template_has_no_placeholders";
  }

  // 5. Invoke sms-notify
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sms-notify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "send",
      user_id,
      mobile,
      template_name: ev.template_name,
      variables: alignedVariables,
      category: ev.category,
      priority: ev.priority,
      source: source || `event:${event_type}`,
      bypass_quota: bypass_quota === true,
    }),
  });

  const result = await res.json().catch(() => ({}));

  // 6. Update dedupe (success or attempt)
  if (!isCritical) {
    const today = new Date().toISOString().slice(0, 10);
    await sb.from("sms_event_dedupe").upsert(
      {
        user_id,
        event_key: event_type,
        last_fired_at: new Date().toISOString(),
        day_key: today,
        daily_count: 1,
      },
      { onConflict: "user_id,event_key" },
    );
  }

  const ok = result?.ok !== false && res.ok;
  await audit(
    user_id,
    event_type,
    ok ? "sent" : "failed",
    ok ? "delivered" : (result?.reason || result?.error || `http_${res.status}`),
    {
      result,
      template_name: ev.template_name,
      variables_sent: alignedVariables,
      template_vars: tpl?.variables ?? null,
      alignment_note: alignmentNote,
    },
  );

  return { ok, status: result?.status || (ok ? "sent" : "failed"), result, alignment_note: alignmentNote };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as EventInput;
    const { event_type, user_id, user_ids, data = {}, override_mobile, source, bypass_quota } = body as any;

    if (!event_type) {
      return new Response(JSON.stringify({ ok: false, error: "event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targets: string[] = user_ids?.length ? user_ids : user_id ? [user_id] : [];
    if (!targets.length) {
      return new Response(JSON.stringify({ ok: false, error: "user_id or user_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      targets.map((uid) =>
        processOne({ event_type, user_id: uid, data, override_mobile, source }).catch((e) => ({
          ok: false,
          status: "exception",
          error: String(e?.message || e),
        })),
      ),
    );

    const sent = results.filter((r: any) => r.ok).length;

    return new Response(
      JSON.stringify({ ok: true, event: event_type, total: targets.length, sent, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sms-event-engine error", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
