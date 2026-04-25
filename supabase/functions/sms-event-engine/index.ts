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
    } else if (key === "time") {
      out[slot] = data.time ?? new Date().toISOString().slice(11, 16);
    } else {
      out[slot] = (data as any)[key] ?? "";
    }
  }
  // Always pass through link/url too so sms-notify auto-mapping works.
  if (data.link) out.link = data.link;
  if (data.url) out.url = data.url;
  if (data.name && !out.var1) out.var1 = data.name;
  return out;
}

async function processOne(input: { event_type: string; user_id: string; data: Record<string, unknown>; override_mobile?: string; source?: string }) {
  const { event_type, user_id, data, override_mobile, source } = input;

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

  const isCritical = ev.bypass_quota === true || ["critical", "otp", "security", "payment"].includes(ev.category);

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
  const rawVariables = mapVariables(data || {}, (ev.variable_map as any) || {}, userName);

  // 4b. Auto-align to the template's registered variable list.
  // MSG91 / DLT will silently reject (or fail to deliver) when extra variables
  // are sent or when names don't match the template's registered slots.
  const { data: tpl } = await sb
    .from("sms_templates")
    .select("name, variables, dlt_template_id, body_template")
    .eq("name", ev.template_name)
    .maybeSingle();

  let alignedVariables: Record<string, unknown> = rawVariables;
  let alignmentNote: string | null = null;

  if (tpl?.variables && Array.isArray(tpl.variables) && tpl.variables.length > 0) {
    const aligned: Record<string, unknown> = {};
    const allValues = Object.entries(rawVariables).filter(([k]) => k !== "link" && k !== "url" && k !== "name");
    (tpl.variables as string[]).forEach((slot, i) => {
      // 1) try exact key match
      if (rawVariables[slot] !== undefined) {
        aligned[slot] = rawVariables[slot];
      } else {
        // 2) fall back to positional value from rawVariables (var1/var2/...)
        const positional = rawVariables[`var${i + 1}`] ?? allValues[i]?.[1];
        aligned[slot] = positional ?? "";
      }
    });
    // pass-through name/link/url for sms-notify auto-mapping
    if (rawVariables.name) aligned.name = rawVariables.name;
    if (rawVariables.link) aligned.link = rawVariables.link;
    if (rawVariables.url) aligned.url = rawVariables.url;

    alignedVariables = aligned;
    alignmentNote = `aligned_to_template_vars:${(tpl.variables as string[]).join(",")}`;
  } else if (tpl) {
    alignmentNote = "template_has_no_variables_declared";
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
    // Also bump count if same day
    await sb.rpc("noop", {}).catch(() => {}); // placeholder
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
    const { event_type, user_id, user_ids, data = {}, override_mobile, source } = body;

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
