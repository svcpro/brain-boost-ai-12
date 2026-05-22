// ═══════════════════════════════════════════════════════════════════
// Voice AI Time Picker — runs once daily (early morning IST).
// Uses Lovable AI to pick the optimal 90-minute send window for the
// `daily_ai_tools_alert` Voice Broadcast event, then writes the
// chosen window into voice_broadcast_event_voices.
// ═══════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const EVENT_KEY = "daily_ai_tools_alert";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function clampIST(hhmm: string, fallback: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!m) return fallback;
  let h = Math.max(8, Math.min(21, parseInt(m[1], 10)));
  let mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(22 * 60, h * 60 + m + mins);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const istNow = new Date(Date.now() + 5.5 * 3600_000);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][istNow.getUTCDay()];
    const dateStr = istNow.toISOString().slice(0, 10);

    // Ask Lovable AI for the best single time today (HH:MM, IST, 24h).
    let pickedStart = "09:30";
    let rationale = "default";
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          tools: [{
            type: "function",
            function: {
              name: "pick_broadcast_time",
              description: "Pick the single best IST time (HH:MM, 24h) today to call Indian exam aspirants with an AI-tools voice alert. Prefer windows with high pick-up: 09:00-11:00 or 18:00-20:00. Avoid 12:00-14:00 (lunch/class) and after 21:00.",
              parameters: {
                type: "object",
                properties: {
                  time_ist: { type: "string", description: "HH:MM in 24h IST, between 08:30 and 20:30" },
                  reason: { type: "string" },
                },
                required: ["time_ist", "reason"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "pick_broadcast_time" } },
          messages: [
            { role: "system", content: "You optimize voice-call timing for Indian exam aspirants (UPSC/SSC/NEET/JEE/Bank). Choose ONE precise IST time today that maximizes call pick-up rate for a short AI-tools alert. Output via the tool only." },
            { role: "user", content: `Today is ${weekday}, ${dateStr}. Pick today's best IST time for a 90-minute send window. Constraints: 08:30 ≤ time ≤ 20:30. Avoid 12:00–14:00. Weekends can lean a bit later morning. Provide a short reason.` },
          ],
        }),
      });
      if (aiRes.ok) {
        const data = await aiRes.json();
        const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          const parsed = JSON.parse(args);
          pickedStart = clampIST(parsed.time_ist, "09:30");
          rationale = String(parsed.reason || "").slice(0, 240);
        }
      } else {
        rationale = `ai_${aiRes.status}_fallback`;
      }
    } catch (e) {
      rationale = `ai_error_${(e as Error).message}_fallback`;
    }

    const sendStart = pickedStart;
    const sendEnd = addMinutes(pickedStart, 90); // 90-min execution window

    // Persist new window on the event row + ensure active
    const { error: upErr } = await supabase
      .from("voice_broadcast_event_voices")
      .update({
        send_window_start: `${sendStart}:00`,
        send_window_end: `${sendEnd}:00`,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", EVENT_KEY);

    if (upErr) return json({ ok: false, error: upErr.message }, 500);

    return json({
      ok: true,
      event_key: EVENT_KEY,
      ist_date: dateStr,
      send_window_start: sendStart,
      send_window_end: sendEnd,
      reason: rationale,
    });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
