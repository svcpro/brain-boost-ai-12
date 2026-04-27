// SMS scheduled drainer
// Runs every few minutes via cron. Picks up due rows in sms_scheduled_dispatches
// and dispatches them through sms-event-engine. Marks rows sent/failed.

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
function hourOfDayIST(d = new Date()): number {
  return new Date(d.getTime() + IST_OFFSET_MS).getUTCHours();
}

async function drainOnce(limit = 50) {
  // Honour quiet hours (22:00–08:00 IST) — defer until morning.
  const istHour = hourOfDayIST();
  if (istHour >= 22 || istHour < 8) {
    return { ok: true, skipped: "quiet_hours_ist", ist_hour: istHour, processed: 0 };
  }

  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb
    .from("sms_scheduled_dispatches")
    .select("id, user_id, event_key, payload, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!due || due.length === 0) {
    return { ok: true, processed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const results: any[] = [];

  for (const row of due) {
    // Optimistic claim — atomically flip pending → processing for this row.
    const { data: claimed, error: claimErr } = await sb
      .from("sms_scheduled_dispatches")
      .update({ status: "processing", attempts: (row.attempts || 0) + 1 })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) continue; // someone else got it

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sms-event-engine`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: row.event_key,
          user_id: row.user_id,
          data: row.payload || {},
          source: "scheduled_drainer",
        }),
      });
      const body = await res.json().catch(() => ({}));
      const ok = res.ok && (body?.ok ?? true);

      await sb.from("sms_scheduled_dispatches").update({
        status: ok ? "sent" : "failed",
        sent_at: ok ? new Date().toISOString() : null,
        last_error: ok ? null : (body?.error || `engine_${res.status}`),
      }).eq("id", row.id);

      if (ok) sent += 1; else failed += 1;
      results.push({ id: row.id, ok, status: res.status });
    } catch (err) {
      failed += 1;
      await sb.from("sms_scheduled_dispatches").update({
        status: "failed",
        last_error: (err as Error).message?.slice(0, 500) || "unknown",
      }).eq("id", row.id);
      results.push({ id: row.id, ok: false, error: (err as Error).message });
    }
  }

  return { ok: true, processed: due.length, sent, failed, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || "50")));
    const out = await drainOnce(limit);
    return new Response(JSON.stringify(out), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sms-scheduled-drainer error", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
