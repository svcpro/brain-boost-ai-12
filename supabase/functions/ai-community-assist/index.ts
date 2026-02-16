import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const { action, name, category, exam_type, subject } = await req.json();

    if (action === "suggest_community") {
      const context = category === "exam" ? `for ${exam_type || "competitive exam"} preparation` :
        category === "subject" ? `for studying ${subject || "the subject"}` :
        category === "topic" ? `about the specific topic "${name}"` : `for general discussion about "${name}"`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You help create engaging study communities. Return JSON only." },
            { role: "user", content: `Generate a community description and rules for "${name}" ${context}.
Return JSON: { "description": "2-3 sentence engaging description", "rules": ["rule1", "rule2", "rule3", "rule4"] }
Rules should be about respectful discussion, staying on topic, no spam, and sharing quality content.` },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) throw new Error("AI request failed");
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return new Response(JSON.stringify(parsed), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch { /* fallback */ }

      return new Response(JSON.stringify({
        description: `A community ${context}. Join to discuss, share resources, and learn together!`,
        rules: ["Be respectful", "Stay on topic", "No spam", "Share quality content"],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "suggest_post_tags") {
      const { title, content } = await req.json();
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Extract topic tags from educational content. Return JSON array of 3-5 tags." },
            { role: "user", content: `Title: ${title}\nContent: ${content}\nReturn JSON: ["tag1", "tag2", "tag3"]` },
          ],
          max_tokens: 100,
          temperature: 0.3,
        }),
      });

      if (!response.ok) throw new Error("AI failed");
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      const tags = match ? JSON.parse(match[0]) : [];

      return new Response(JSON.stringify({ tags }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("ai-community-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
