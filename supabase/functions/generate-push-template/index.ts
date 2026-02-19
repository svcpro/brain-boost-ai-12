import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { purpose, category } = await req.json();
    if (!purpose) throw new Error("purpose is required");

    const prompt = `You are a push notification template designer for ACRY Brain, an AI-powered study app.

Generate a push notification template for the following purpose: "${purpose}"
Category: ${category || "general"}

The template must use dynamic variables with {{variable_name}} syntax. Available variables:
- {{user_name}} - User's display name
- {{topic_name}} - Topic or subject name
- {{score}} - Score or percentage value
- {{exam_name}} - User's target exam
- {{streak_days}} - Current streak count
- {{rank}} - User's current rank
- {{days_left}} - Days until exam
- {{memory_strength}} - Memory strength percentage
- {{brain_score}} - Brain performance score
- {{session_minutes}} - Study session duration

Requirements:
1. Title must be max 50 characters, punchy, with one relevant emoji
2. Body must be max 150 characters, personal (use {{user_name}}), actionable
3. Include relevant variables naturally in the text
4. Make it motivating, urgent, or celebratory depending on purpose
5. Sound human, not robotic

Return ONLY a JSON object with these fields:
- "name": template name (descriptive, e.g. "Memory Risk Alert")
- "title_template": the notification title with variables
- "body_template": the notification body with variables
- "category": one of: user_action, ai_prediction, study_reminder, improvement, rank_exam, community, billing, security, engagement, admin
- "priority": one of: low, normal, high, urgent
- "variables": array of variable names used (without braces)

No markdown, no code fences. Just the JSON object.`;

    const { aiFetch } = await import("../_shared/aiFetch.ts");
    const response = await aiFetch({
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-push-template error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
