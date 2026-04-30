// AI-Automated Announcement Generator + Dispatcher
// Admin provides a brief intent (or nothing) — AI writes the push and sends it.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const body = await req.json().catch(() => ({}));
    const intent: string = (body.intent || "").toString().trim();
    const tone: string = (body.tone || "motivating").toString();
    const send: boolean = body.send !== false; // default true
    const scheduled_at: string | null = body.scheduled_at || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Light context — recent successful broadcasts to avoid repetition
    const { data: recent } = await supabase
      .from("push_campaigns")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(5);
    const recentTitles = (recent || []).map((r: any) => r.title).filter(Boolean).join(" | ");

    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

    const prompt = `You are the announcement composer for ACRY Brain — an AI study app for Indian exam aspirants (UPSC, SSC, NEET, JEE, Banking, etc).

TASK: Write ONE push notification announcement for ALL users.
${intent ? `ADMIN INTENT: "${intent}"` : "ADMIN INTENT: Auto-pick the most engaging announcement for today (study motivation, feature reminder, streak nudge, exam tip, or product update)."}
TONE: ${tone}
TODAY: ${today}
RECENT TITLES (avoid duplicates): ${recentTitles || "none"}

RULES:
- Title ≤ 50 chars, exactly ONE relevant emoji at start, punchy.
- Body ≤ 140 chars, second-person ("you / your"), one clear action.
- Pick deep_link from: /app, /app?tab=brain, /app?tab=action, /app?tab=sureshot, /app?tab=you, /app/brainlens
- No markdown, no quotes, no hashtags.

Return ONLY JSON: {"title":"...", "body":"...", "deep_link":"/app"}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "emit_announcement",
            description: "Emit the final announcement",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string" },
                deep_link: { type: "string" },
              },
              required: ["title", "body", "deep_link"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_announcement" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway", aiResp.status, t.slice(0, 200));
      if (aiResp.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted. Add credits in workspace settings." }, 402);
      return json({ error: "AI generation failed" }, 500);
    }

    const ai = await aiResp.json();
    const args = ai.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { title: string; body: string; deep_link: string } | null = null;
    try { parsed = args ? JSON.parse(args) : null; } catch { parsed = null; }

    // Fallback: parse from plain content
    if (!parsed) {
      const content = ai.choices?.[0]?.message?.content || "";
      const m = content.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch { /* */ }
    }

    if (!parsed?.title || !parsed?.body) {
      return json({ error: "AI returned no usable content" }, 500);
    }

    const title = String(parsed.title).slice(0, 60);
    const announcementBody = String(parsed.body).slice(0, 200);
    const deep_link = String(parsed.deep_link || "/app");

    // Schedule path — store in campaigns, cron will fire
    if (scheduled_at) {
      const { error } = await supabase.from("push_campaigns").insert({
        name: title, title, body: announcementBody, deep_link,
        status: "scheduled", scheduled_at: new Date(scheduled_at).toISOString(),
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, scheduled: true, title, body: announcementBody, deep_link });
    }

    if (!send) {
      return json({ ok: true, preview: true, title, body: announcementBody, deep_link });
    }

    // Dispatch immediately via existing OneSignal dispatcher
    const dispatch = await supabase.functions.invoke("onesignal-dispatch", {
      body: { action: "send_broadcast", title, body: announcementBody, deep_link },
    });
    if (dispatch.error) return json({ error: dispatch.error.message }, 500);
    const dr: any = dispatch.data;
    if (dr?.error) return json({ error: dr.error, title, body: announcementBody, deep_link }, 500);

    // Log as a campaign for history
    await supabase.from("push_campaigns").insert({
      name: title, title, body: announcementBody, deep_link,
      status: "sent", sent_at: new Date().toISOString(),
    });

    return json({ ok: true, sent: true, title, body: announcementBody, deep_link, onesignal_id: dr?.id });
  } catch (e) {
    console.error("ai-announcement error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
