import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { post_id, title, content } = await req.json();
    if (!post_id || !content) throw new Error("Missing post data");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert tutor for competitive exams (JEE, NEET, UPSC, SSC, etc). Provide clear, accurate, and concise answers. Use examples when helpful. Format with bullet points for clarity. Keep answers under 300 words." },
          { role: "user", content: `Question: ${title}\n\nDetails: ${content}\n\nProvide a clear, helpful answer.` },
        ],
        max_tokens: 800,
        temperature: 0.5,
      }),
    });

    if (!response.ok) throw new Error("AI request failed");
    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "";

    // Save AI answer to post
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await adminClient.from("community_posts").update({ ai_answer: answer, ai_answered_at: new Date().toISOString() }).eq("id", post_id);

    // Also insert as AI comment
    await adminClient.from("post_comments").insert({
      post_id, user_id: user.id, content: answer, is_ai_answer: true,
    });

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-community-answer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
